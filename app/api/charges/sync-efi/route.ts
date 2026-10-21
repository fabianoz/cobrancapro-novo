export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';
import { consultarPix } from '@/lib/efi/pix';
import { consultarBoleto } from '@/lib/efi/boleto';
import { getAsaasCharge } from '@/lib/asaas/client';
import { getInterCharge } from '@/lib/inter/client';

/**
 * POST /api/charges/sync-efi
 *
 * Sincroniza todas as cobranças PENDING com a API da Efí.
 * Para cada cobrança pendente:
 * - Se tem txid, consulta Pix (GET /v2/cob/{txid}) — se CONCLUIDA marca PAGO
 * - Se tem boleto_charge_id, consulta boleto (GET /v1/charge/{id}) — se paid/settled marca PAGO
 */
export async function POST() {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const { data: pendingCharges, error: chargesError } = await supabaseAdmin
      .from('charges')
      .select('id, external_id, txid, boleto_charge_id, status, value, provider')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (chargesError) {
      return NextResponse.json({ success: false, error: 'Não foi possível carregar as cobranças do banco ativo' }, { status: 500 });
    }

    if (!pendingCharges || pendingCharges.length === 0) {
      return NextResponse.json({ success: true, checked: 0, updated: 0, message: 'Nenhuma cobrança pendente' });
    }

    let checked = 0;
    let updated = 0;
    const results: { id: string; txid: string | null; boleto_id: string | null; newStatus: string; method: string }[] = [];

    for (const charge of pendingCharges) {
      if (charge.external_id?.startsWith('local-')) continue;
      checked++;

      let newStatus = 'PENDING';
      let paymentMethod = '';
      let valorPago: number | null = null;

      if (charge.provider === 'ASAAS') {
        try {
          const asaasCharge = await getAsaasCharge(charge.external_id);
          if (asaasCharge.status === 'PAID') {
            newStatus = 'PAID';
            paymentMethod = 'ASAAS';
            valorPago = Number(charge.value);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`[Sync Asaas] Erro ao consultar ${charge.external_id}: ${msg.slice(0, 120)}`);
        }
      }

      if (charge.provider === 'ASAAS') {
        if (newStatus !== 'PENDING' && newStatus !== charge.status) {
          await supabaseAdmin.from('charges').update({
            status: newStatus,
            paid_at: new Date().toISOString(),
            data_pagamento: new Date().toISOString(),
            payment_method: paymentMethod,
            valor_pago: valorPago,
          }).eq('id', charge.id);
          updated++;
          results.push({ id: charge.id, txid: charge.txid, boleto_id: charge.boleto_charge_id, newStatus, method: paymentMethod });
        }
        continue;
      }

      if (charge.provider === 'INTER') {
        try {
          const interCharge = await getInterCharge(charge.external_id);
          if (interCharge.situacao === 'PAGO' || interCharge.situacao === 'RECEBIDO') {
            newStatus = 'PAID';
            paymentMethod = 'INTER';
            valorPago = Number(charge.value);
          } else if (interCharge.situacao === 'CANCELADO' || interCharge.situacao === 'EXPIRADO') {
            newStatus = 'CANCELLED';
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`[Sync Inter] Erro ao consultar ${charge.external_id}: ${msg.slice(0, 120)}`);
        }

        if (newStatus !== 'PENDING' && newStatus !== charge.status) {
          await supabaseAdmin.from('charges').update({
            status: newStatus,
            paid_at: newStatus === 'PAID' ? new Date().toISOString() : null,
            data_pagamento: newStatus === 'PAID' ? new Date().toISOString() : null,
            payment_method: newStatus === 'PAID' ? paymentMethod : null,
            valor_pago: newStatus === 'PAID' ? valorPago : null,
          }).eq('id', charge.id);
          updated++;
          results.push({ id: charge.id, txid: charge.txid, boleto_id: charge.boleto_charge_id, newStatus, method: paymentMethod });
        }
        continue;
      }

      // === Check Pix ===
      if (charge.txid) {
        try {
          console.log(`[Sync EFI] Consultando Pix txid: ${charge.txid}`);
          const pix = await consultarPix(charge.txid);
          console.log(`[Sync EFI] Pix ${charge.txid} status: ${pix.status}`);
          if (pix.status === 'CONCLUIDA') {
            newStatus = 'PAID';
            paymentMethod = 'PIX';
            valorPago = pix.valor || Number(charge.value);
          } else if (pix.status === 'REMOVIDA_PELO_USUARIO_RECEBEDOR' || pix.status === 'REMOVIDA_PELO_PSP') {
            // Pix removed, check boleto below
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`[Sync EFI] Erro ao consultar pix ${charge.txid}: ${msg.slice(0, 120)}`);
        }
      }

      // === Check Boleto (if not already paid by pix) ===
      if (newStatus !== 'PAID' && charge.boleto_charge_id) {
        try {
          console.log(`[Sync EFI] Consultando boleto: ${charge.boleto_charge_id}`);
          const boleto = await consultarBoleto(charge.boleto_charge_id);
          console.log(`[Sync EFI] Boleto ${charge.boleto_charge_id} status: ${boleto.status}`);
          if (boleto.status === 'paid' || boleto.status === 'settled') {
            newStatus = 'PAID';
            paymentMethod = 'BOLETO';
            valorPago = Number(charge.value);
          } else if (boleto.status === 'unpaid' || boleto.status === 'refunded') {
            newStatus = 'CANCELLED';
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`[Sync EFI] Erro ao consultar boleto ${charge.boleto_charge_id}: ${msg.slice(0, 120)}`);
        }
      }

      // === Fallback: check external_id as txid ===
      if (newStatus !== 'PAID' && newStatus !== 'CANCELLED' && charge.external_id) {
        const extId = charge.external_id;
        if (extId.length > 20 && /^[a-zA-Z0-9]+$/.test(extId) && extId !== charge.txid) {
          try {
            console.log(`[Sync EFI] Consultando external_id como pix: ${extId}`);
            const pix = await consultarPix(extId);
            if (pix.status === 'CONCLUIDA') {
              newStatus = 'PAID';
              paymentMethod = 'PIX';
              valorPago = pix.valor || Number(charge.value);
            }
          } catch {
            // external_id may not be a valid txid
          }
        }
      }

      if (newStatus !== 'PENDING' && newStatus !== charge.status) {
        const updateData: Record<string, unknown> = {
          status: newStatus,
          paid_at: newStatus === 'PAID' ? new Date().toISOString() : null,
          data_pagamento: newStatus === 'PAID' ? new Date().toISOString() : null,
          payment_method: newStatus === 'PAID' ? paymentMethod : null,
          valor_pago: newStatus === 'PAID' ? valorPago : null,
        };

        await supabaseAdmin
          .from('charges')
          .update(updateData)
          .eq('id', charge.id);

        updated++;
        results.push({
          id: charge.id,
          txid: charge.txid,
          boleto_id: charge.boleto_charge_id,
          newStatus,
          method: paymentMethod,
        });

        console.log(`[Sync EFI] Cobrança ${charge.id} atualizada: ${charge.status} -> ${newStatus} (${paymentMethod})`);
      }
    }

    return NextResponse.json({ success: true, checked, updated, results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Sync EFI] Erro geral:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
