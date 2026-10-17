export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json();
    const event = body.event;
    const payment = body.payment;

    if (!payment || !payment.id) {
      return NextResponse.json({ ok: true });
    }

    const externalId = String(payment.id);
    const status = String(payment.status || '').toUpperCase();

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED' || status === 'RECEIVED' || status === 'CONFIRMED') {
      const { data: charge } = await supabaseAdmin
        .from('charges')
        .select('id')
        .eq('external_id', externalId)
        .maybeSingle();

      if (charge) {
        await supabaseAdmin
          .from('charges')
          .update({
            status: 'PAID',
            paid_at: new Date().toISOString(),
            payment_method: payment.billingType || null,
            valor_pago: payment.value ? Number(payment.value) : null,
            data_pagamento: payment.paymentDate || new Date().toISOString(),
          })
          .eq('id', charge.id);
      }
    } else if (event === 'PAYMENT_OVERDUE' || status === 'OVERDUE') {
      const { data: charge } = await supabaseAdmin
        .from('charges')
        .select('id')
        .eq('external_id', externalId)
        .maybeSingle();

      if (charge) {
        await supabaseAdmin
          .from('charges')
          .update({ status: 'OVERDUE' })
          .eq('id', charge.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
