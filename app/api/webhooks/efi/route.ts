import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendWhatsApp } from '@/lib/whatsapp';
import { cancelarBoleto } from '@/lib/efi/boleto';
import { efiFetch } from '@/lib/efi/auth';
import type { Customer, Charge } from '@/lib/supabase';

/**
 * EFI Webhook principal — recebe notificações de Pix e Boleto.
 *
 * Formato Pix: { pix: [{ txid, valor, horario, pagador }] }
 * Formato Boleto: { data: { id, status } }
 *
 * Sempre responde 200 { ok: true }.
 *
 * Se pagar via Pix, cancela o boleto associado automaticamente.
 * Se pagar via Boleto, cancela o Pix associado automaticamente.
 */

async function cancelBoleto(charge: Charge) {
  if (!charge.boleto_charge_id) return;
  try {
    await cancelarBoleto(charge.boleto_charge_id);
    await supabaseAdmin
      .from('charges')
      .update({ boleto_status: 'CANCELADO' })
      .eq('id', charge.id);
    console.log('[EFI Webhook] Pix pago, boleto cancelado:', charge.boleto_charge_id);
  } catch (err) {
    console.warn('[EFI Webhook] Erro ao cancelar boleto:', err instanceof Error ? err.message : String(err));
  }
}

async function cancelPix(txid: string) {
  if (!txid) return;
  try {
    await efiFetch(`/v2/cob/${txid}`, { method: 'DELETE' });
    console.log('[EFI Webhook] Boleto pago, pix cancelado:', txid);
  } catch (err) {
    console.warn('[EFI Webhook] Erro ao cancelar pix:', err instanceof Error ? err.message : String(err));
  }
}

async function markPaidAndNotify(charge: Charge, paymentMethod: string, valorPago?: number) {
  if (charge.status === 'PAID') return;

  await supabaseAdmin
    .from('charges')
    .update({
      status: 'PAID',
      paid_at: new Date().toISOString(),
      data_pagamento: new Date().toISOString(),
      payment_method: paymentMethod,
      valor_pago: valorPago || Number(charge.value),
      boleto_status: paymentMethod === 'PIX' ? 'CANCELADO' : charge.boleto_status,
    })
    .eq('id', charge.id);

  if (charge.customer) {
    const customer = charge.customer as Customer;
    try {
      const msg = `Pagamento confirmado! Recebemos ${new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(charge.value))}. Obrigado, ${customer.name.split(' ')[0]}!`;
      await sendWhatsApp(customer.whatsapp || '', msg);
    } catch {
      // non-critical
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('[EFI Webhook] Payload recebido:', JSON.stringify(body).slice(0, 500));

    // === Formato 1: Pix ===
    const pixList = body?.pix;
    if (Array.isArray(pixList) && pixList.length > 0) {
      for (const pix of pixList) {
        const txid = pix.txid || '';
        if (!txid) continue;

        console.log(`[EFI Webhook] Pix recebido — txid: ${txid}, valor: ${pix.valor}`);

        // Busca por txid ou external_id
        let { data: charge } = await supabaseAdmin
          .from('charges')
          .select('*, customer:customers(*)')
          .eq('txid', txid)
          .maybeSingle();

        if (!charge) {
          const r2 = await supabaseAdmin
            .from('charges')
            .select('*, customer:customers(*)')
            .eq('external_id', txid)
            .maybeSingle();
          charge = r2.data;
        }

        if (charge) {
          await markPaidAndNotify(charge as Charge, 'PIX', pix.valor);
          // Cancel boleto if exists
          if ((charge as Charge).boleto_charge_id) {
            await cancelBoleto(charge as Charge);
          }
          console.log(`[EFI Webhook] Cobrança ${charge.id} marcada como PAGO (PIX)`);
        } else {
          console.log(`[EFI Webhook] Cobrança não encontrada para txid: ${txid}`);
        }
      }
      return NextResponse.json({ ok: true });
    }

    // === Formato 2: Boleto ===
    const chargeId = body?.data?.id || body?.data?.charge_id || body?.charge_id;
    const status = body?.data?.status || body?.status;

    if (!chargeId) {
      console.log('[EFI Webhook] Sem charge ID no payload');
      return NextResponse.json({ ok: true });
    }

    console.log(`[EFI Webhook] Boleto — chargeId: ${chargeId}, status: ${status}`);

    // Busca por boleto_charge_id ou external_id
    let { data: charge } = await supabaseAdmin
      .from('charges')
      .select('*, customer:customers(*)')
      .eq('boleto_charge_id', String(chargeId))
      .maybeSingle();

    if (!charge) {
      const r2 = await supabaseAdmin
        .from('charges')
        .select('*, customer:customers(*)')
        .eq('external_id', String(chargeId))
        .maybeSingle();
      charge = r2.data;
    }

    if (!charge) {
      console.log(`[EFI Webhook] Cobrança não encontrada: ${chargeId}`);
      return NextResponse.json({ ok: true });
    }

    const efiStatus = String(status).toLowerCase();
    let newStatus = charge.status;

    if (efiStatus === 'paid' || efiStatus === 'settled' || efiStatus === 'contested') {
      newStatus = 'PAID';
    } else if (efiStatus === 'unpaid' || efiStatus === 'refunded') {
      newStatus = 'CANCELLED';
    } else if (efiStatus === 'waiting' || efiStatus === 'pending') {
      newStatus = 'PENDING';
    }

    if (newStatus === 'PAID' && charge.status !== 'PAID') {
      await markPaidAndNotify(charge as Charge, 'BOLETO');
      // Cancel pix if exists
      if ((charge as Charge).txid) {
        await cancelPix((charge as Charge).txid!);
      }
      console.log(`[EFI Webhook] Boleto pago, cobrança ${charge.id} marcada PAGO`);
    } else if (newStatus !== charge.status) {
      await supabaseAdmin
        .from('charges')
        .update({ status: newStatus, boleto_status: efiStatus })
        .eq('id', charge.id);
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[EFI Webhook] Erro:', message);
    // Always return 200 so EFI doesn't retry indefinitely
    return NextResponse.json({ ok: true, error: message });
  }
}
