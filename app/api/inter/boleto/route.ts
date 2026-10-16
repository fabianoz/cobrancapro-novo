import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createInterCharge, isInterConfigured } from '@/lib/inter/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { valor, nome, cpfCnpj, email, telefone, vencimento, customerId, mensagem } = body;

    if (!valor || !nome || !cpfCnpj || !vencimento) {
      return NextResponse.json(
        { error: 'valor, nome, cpfCnpj e vencimento são obrigatórios' },
        { status: 400 }
      );
    }

    const configured = await isInterConfigured();
    if (!configured) {
      return NextResponse.json(
        { error: 'Banco Inter não configurado. Configure Client ID, Client Secret e certificados nas Configurações.' },
        { status: 400 }
      );
    }

    const customerCity: string | undefined = body.cidade;
    const customerUf: string | undefined = body.uf;

    const externalRef = `IN${Date.now()}`;
    const charge = await createInterCharge({
      seuNumero: externalRef,
      valor: Number(valor),
      vencimento,
      pagador: {
        cpfCnpj,
        nome,
        email: email || undefined,
        cidade: customerCity,
        uf: customerUf,
      },
      mensagem: mensagem || 'Cobrança CobrancaPro',
    });

    let savedCharge: Record<string, unknown> | null = null;
    if (customerId) {
      const { data, error } = await supabaseAdmin
        .from('charges')
        .insert({
          customer_id: customerId,
          value: Number(valor),
          due_date: vencimento,
          status: 'PENDING',
          provider: 'INTER',
          external_id: charge.codigoSolicitacao,
          boleto_charge_id: charge.codigoSolicitacao,
          barcode: charge.linhaDigitavel,
          barcode_boleto: charge.linhaDigitavel,
          boleto_linha: charge.linhaDigitavel,
          boleto_url: charge.pdfUrl || null,
          billet_pdf_url: charge.pdfUrl || null,
          pix_copy_paste: charge.pixCopiaECola || null,
          payment_url: charge.pdfUrl || null,
          boleto_status: charge.situacao,
          charge_type: 'SALE',
          description: mensagem || 'Boleto Banco Inter',
        })
        .select('*, customer:customers(*)')
        .single();

      if (error) {
        console.error('[Inter Boleto] Erro ao salvar no DB:', error.message);
      } else {
        savedCharge = data;
      }
    }

    return NextResponse.json({
      success: true,
      boleto: {
        chargeId: charge.codigoSolicitacao,
        barcode: charge.linhaDigitavel,
        pdf: charge.pdfUrl,
        paymentUrl: charge.pdfUrl,
        pixCopyPaste: charge.pixCopiaECola,
        status: charge.situacao,
      },
      charge: savedCharge,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Inter Boleto] ERRO:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
