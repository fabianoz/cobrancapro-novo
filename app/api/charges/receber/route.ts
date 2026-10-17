export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';

export async function POST(req: NextRequest) {
    const supabase = getSupabaseAdmin();
  try {
    const body = await req.json();
    const { chargeId, valorPago, desconto, dataPagamento } = body;

    if (!chargeId) {
      return NextResponse.json({ success: false, error: 'chargeId obrigatório' }, { status: 400 });
    }

    const { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select('id, value')
      .eq('id', chargeId)
      .maybeSingle();

    if (chargeError || !charge) {
      return NextResponse.json({ success: false, error: 'Cobrança não encontrada' }, { status: 404 });
    }

    const finalValue = valorPago !== undefined && valorPago !== null
      ? Number(valorPago)
      : Number(charge.value) - (Number(desconto) || 0);

    const { error: updateError } = await supabase
      .from('charges')
      .update({
        status: 'PAID',
        paid_at: dataPagamento || new Date().toISOString(),
        valor_pago: finalValue,
        data_pagamento: dataPagamento || new Date().toISOString(),
      })
      .eq('id', chargeId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, valorPago: finalValue });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro ao receber cobrança' },
      { status: 500 },
    );
  }
}
