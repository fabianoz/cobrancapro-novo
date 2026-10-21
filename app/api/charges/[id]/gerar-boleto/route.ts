export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';
import { getProvider } from '@/lib/providers';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: charge, error: chargeError } = await supabaseAdmin
      .from('charges')
      .select('*, customer:customers(*)')
      .eq('id', params.id)
      .maybeSingle();

    if (chargeError || !charge) {
      return NextResponse.json({ success: false, error: 'Cobrança não encontrada' }, { status: 404 });
    }

    if (!charge.customer) {
      return NextResponse.json({ success: false, error: 'Cliente da cobrança não encontrado' }, { status: 400 });
    }

    const provider = getProvider(charge.provider);
    const providerCharge = await provider.createCharge({
      customerName: charge.customer.name,
      customerCpfCnpj: charge.customer.cpf_cnpj,
      customerEmail: charge.customer.email || '',
      customerPhone: charge.customer.whatsapp || '',
      value: Number(charge.value),
      dueDate: charge.due_date,
      externalReference: charge.external_id || `CP${Date.now()}`,
    });

    const { data: updatedCharge, error: updateError } = await supabaseAdmin
      .from('charges')
      .update({
        boleto_charge_id: providerCharge.externalId || null,
        barcode: providerCharge.barcode || null,
        barcode_boleto: providerCharge.barcode || null,
        boleto_linha: providerCharge.barcode || null,
        boleto_url: providerCharge.billetPdfUrl || null,
        billet_pdf_url: providerCharge.billetPdfUrl || null,
        payment_url: providerCharge.paymentUrl || null,
        boleto_status: providerCharge.status || 'PENDING',
        erro_boleto: null,
        pix_copy_paste: charge.pix_copy_paste || providerCharge.pixCopyPaste || null,
        pix_qr_code: charge.pix_qr_code || providerCharge.pixQrCode || null,
      })
      .eq('id', charge.id)
      .select('*, customer:customers(*)')
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Boleto gerado, mas não foi possível salvar os dados' }, { status: 500 });
    }

    return NextResponse.json({ success: true, charge: updatedCharge });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível gerar o boleto';
    await supabaseAdmin
      .from('charges')
      .update({ erro_boleto: message })
      .eq('id', params.id);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
