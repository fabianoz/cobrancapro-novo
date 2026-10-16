import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { criarBoleto } from '@/lib/efi/boleto';
import { createAsaasCharge } from '@/lib/asaas/client';

/**
 * POST /api/charges/[id]/gerar-boleto
 *
 * Retries boleto generation for an existing charge that has no boleto yet
 * (or whose boleto failed previously). Saves the result back to the charge
 * and clears erro_boleto on success.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const chargeId = params.id;
  if (!chargeId) {
    return NextResponse.json({ error: 'ID da cobrança é obrigatório' }, { status: 400 });
  }

  const { data: charge, error: loadErr } = await supabaseAdmin
    .from('charges')
    .select('*, customer:customers(*)')
    .eq('id', chargeId)
    .maybeSingle();

  if (loadErr || !charge) {
    return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 });
  }

  if (charge.boleto_charge_id) {
    return NextResponse.json({ success: true, message: 'Boleto já existe para esta cobrança', charge });
  }

  const customer = charge.customer;
  if (!customer) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  }

  const cpfLimpo = (customer.cpf_cnpj || '').replace(/\D/g, '');
  if (!cpfLimpo || (cpfLimpo.length !== 11 && cpfLimpo.length !== 14)) {
    const msg = `Cliente "${customer.name}" sem CPF/CNPJ válido. Cadastre o documento do cliente antes de gerar boleto.`;
    await supabaseAdmin.from('charges').update({ erro_boleto: msg }).eq('id', chargeId);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('billing_provider')
    .eq('id', 1)
    .maybeSingle();
  const activeProvider = charge.status === 'PAID' ? charge.provider : (settings?.billing_provider || charge.provider);

  const forwardedProto = _request.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = _request.headers.get('x-forwarded-host') || _request.headers.get('host') || '';
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BOLT_PUBLIC_URL || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : '');
  const webhookUrl = publicUrl ? `${publicUrl}/api/webhooks/${activeProvider === 'ASAAS' ? 'asaas' : 'efi'}` : undefined;

  try {
    console.log('>>> GERANDO BOLETO (retry) — Charge:', chargeId, '| Cliente:', customer.name);

    const boleto = activeProvider === 'ASAAS'
      ? await createAsaasCharge({
          customerName: customer.name,
          customerCpfCnpj: customer.cpf_cnpj,
          customerEmail: customer.email || '',
          customerPhone: customer.whatsapp || '',
          value: Number(charge.value),
          dueDate: charge.due_date,
          externalReference: charge.external_id || chargeId,
        })
      : await criarBoleto({
          customerName: customer.name,
          customerCpfCnpj: customer.cpf_cnpj,
          customerEmail: customer.email || '',
          customerPhone: customer.whatsapp || '',
          valor: Number(charge.value),
          vencimento: charge.due_date,
          mensagem: charge.description || 'Cobrança CobrancaPro',
          externalReference: charge.external_id || chargeId,
          notificationUrl: webhookUrl,
        });

    const boletoId = 'externalId' in boleto ? boleto.externalId : boleto.chargeId;
    const boletoPdf = 'billetPdfUrl' in boleto ? boleto.billetPdfUrl : boleto.pdf;
    const pixCopyPaste = 'pixCopyPaste' in boleto ? boleto.pixCopyPaste : '';
    const pixQrCode = 'pixQrCode' in boleto ? boleto.pixQrCode : '';

    const { error: updateErr } = await supabaseAdmin
      .from('charges')
      .update({
        provider: activeProvider,
        boleto_charge_id: boletoId,
        barcode: boleto.barcode || null,
        barcode_boleto: boleto.barcode || null,
        boleto_linha: boleto.barcode || null,
        boleto_url: boletoPdf || null,
        billet_pdf_url: boletoPdf || null,
        boleto_status: boleto.status || 'pending',
        payment_url: boleto.paymentUrl || null,
        pix_copy_paste: pixCopyPaste || null,
        pix_qr_code: pixQrCode || null,
        erro_boleto: null,
      })
      .eq('id', chargeId);

    if (updateErr) {
      console.error('[gerar-boleto] Erro ao salvar boleto no DB:', updateErr.message);
    }

    console.log('[gerar-boleto] Boleto gerado com sucesso — chargeId:', boletoId);
    return NextResponse.json({
      success: true,
      message: 'Boleto gerado com sucesso',
      boleto: {
        chargeId: boletoId,
        barcode: boleto.barcode,
        pdf: boletoPdf,
        paymentUrl: boleto.paymentUrl,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[gerar-boleto] ERRO CRÍTICO:', errMsg);

    await supabaseAdmin
      .from('charges')
      .update({ erro_boleto: errMsg })
      .eq('id', chargeId);

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
