import { NextResponse } from 'next/server';
import { handleInterWebhook } from '@/lib/inter/client';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log('[Webhook Inter] Payload recebido:', JSON.stringify(payload).slice(0, 500));

    const result = handleInterWebhook(payload);

    if (result.status === 'PAID' && result.codigo) {
      const { data: charge } = await supabaseAdmin
        .from('charges')
        .select('id, status')
        .eq('boleto_charge_id', result.codigo)
        .maybeSingle();

      if (charge && charge.status !== 'PAID') {
        await supabaseAdmin
          .from('charges')
          .update({
            status: 'PAID',
            paid_at: new Date().toISOString(),
            payment_method: result.method || 'PIX',
          })
          .eq('id', charge.id);

        console.log('[Webhook Inter] Cobrança marcada como PAGA:', result.codigo);
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Webhook Inter] Erro:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
