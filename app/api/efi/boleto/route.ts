import { NextResponse } from 'next/server';
import { criarBoleto, consultarBoleto, cancelarBoleto, baixarPdfBoleto } from '@/lib/efi/boleto';
import { supabaseAdmin } from '@/lib/supabase';
import { sendNotification } from '@/lib/notifications';
import type { Charge, Customer } from '@/lib/supabase';

function getPublicUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.BOLT_PUBLIC_URL;
  if (configured) return configured;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  return host ? `${proto}://${host}` : '';
}

/** Criar boleto/bolix */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { valor, nome, cpfCnpj, email, telefone, vencimento, customerId, mensagem } = body;
    if (!valor || !nome || !cpfCnpj || !vencimento) {
      return NextResponse.json({ error: 'valor, nome, cpfCnpj e vencimento são obrigatórios' }, { status: 400 });
    }

    const boleto = await criarBoleto({
      customerName: nome,
      customerCpfCnpj: cpfCnpj,
      customerEmail: email,
      customerPhone: telefone,
      valor: Number(valor),
      vencimento,
      externalReference: `CP${Date.now()}`,
      notificationUrl: `${getPublicUrl(request)}/api/webhooks/efi`,
      mensagem,
    });

    let charge: Charge | null = null;
    if (customerId) {
      const link = `${getPublicUrl(request)}/fatura/${boleto.chargeId}`;
      const { data, error } = await supabaseAdmin
        .from('charges')
        .insert({
          customer_id: customerId,
          value: Number(valor),
          due_date: vencimento,
          status: 'PENDING',
          provider: 'EFI',
          external_id: boleto.chargeId,
          boleto_charge_id: boleto.chargeId,
          boleto_status: boleto.status,
          barcode: boleto.barcode,
          barcode_boleto: boleto.barcode,
          boleto_linha: boleto.barcode,
          billet_pdf_url: boleto.pdf,
          boleto_url: boleto.pdf,
          payment_url: boleto.paymentUrl,
          pix_copy_paste: boleto.pixCopyPaste || null,
          pix_qr_code: boleto.pixQrCode || null,
          link_fatura_publica: link,
          charge_type: 'SALE',
          description: mensagem || 'Boleto/Bolix',
        })
        .select('*, customer:customers(*)')
        .single();

      if (error) return NextResponse.json({ error: 'Boleto criado, mas não foi salvo no painel' }, { status: 500 });
      charge = data as Charge;
      if (charge.customer) {
        sendNotification(charge, charge.customer as Customer).catch((error: unknown) =>
          console.error('[Boleto] Erro ao enviar link ao cliente:', error)
        );
      }
    }

    return NextResponse.json({ success: true, boleto, charge });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chargeId = searchParams.get('id');
    const pdf = searchParams.get('pdf');
    if (!chargeId) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    if (pdf === 'true') return NextResponse.json({ pdf: await baixarPdfBoleto(chargeId) });
    return NextResponse.json(await consultarBoleto(chargeId));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chargeId = searchParams.get('id');
    const action = searchParams.get('action');
    if (!chargeId) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    if (action !== 'cancel') return NextResponse.json({ error: 'Ação não reconhecida' }, { status: 400 });

    await cancelarBoleto(chargeId);
    const update = { status: 'CANCELLED', boleto_status: 'CANCELADO' };
    await supabaseAdmin.from('charges').update(update).eq('external_id', chargeId);
    await supabaseAdmin.from('charges').update(update).eq('boleto_charge_id', chargeId);
    return NextResponse.json({ success: true, message: 'Cobrança cancelada' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
