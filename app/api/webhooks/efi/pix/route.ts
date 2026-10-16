import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sincronizarStatusCharge } from '@/lib/efi/helper';
import type { Customer } from '@/lib/supabase';

/**
 * Webhook de Pix — Recebe notificações de Pix pago da Efí
 *
 * A Efí envia um POST com:
 * { pix: [{ endToEndId, txid, valor, horario, pagador }] }
 *
 * Ou no formato de notificação:
 * { tipo: 'pix', data: { txid, status } }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Formato 1: notificação de Pix recebido
    const pixList = body?.pix || (body?.data?.pix ? [body.data] : []) || [];

    if (pixList.length === 0) {
      // Pode ser uma notificação de status de cobrança
      const txid = body?.data?.txid || body?.txid;
      if (txid) {
        const { data: charge } = await supabaseAdmin
          .from('charges')
          .select('id, external_id')
          .eq('external_id', txid)
          .maybeSingle();

        if (charge) {
          await sincronizarStatusCharge(charge.id, charge.external_id);
        }
      }
      return NextResponse.json({ success: true });
    }

    for (const pix of pixList) {
      const txid = pix.txid || '';
      if (!txid) continue;

      // Busca a cobrança pelo txid
      const { data: charge } = await supabaseAdmin
        .from('charges')
        .select('*, customer:customers(*)')
        .eq('external_id', txid)
        .maybeSingle();

      if (!charge) continue;

      if (charge.status !== 'PAID') {
        await supabaseAdmin
          .from('charges')
          .update({
            status: 'PAID',
            paid_at: new Date().toISOString(),
            payment_method: 'PIX',
          })
          .eq('id', charge.id);

        // Notifica o cliente via WhatsApp
        if (charge.customer) {
          const customer = charge.customer as Customer;
          const { sendWhatsApp } = await import('@/lib/whatsapp');
          const msg = `Pagamento confirmado! Recebemos ${new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(Number(charge.value))}. Obrigado, ${customer.name.split(' ')[0]}!`;
          sendWhatsApp(customer.whatsapp || '', msg).catch(() => {});
        }
      }
    }

    return NextResponse.json({ success: true, processed: pixList.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[EFI Pix Webhook] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
