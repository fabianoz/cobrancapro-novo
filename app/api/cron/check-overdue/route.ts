export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';
import { sincronizarStatusCharge } from '@/lib/efi/helper';

/**
 * Cron job: verifica cobranças vencidas e sincroniza status com a Efí
 *
 * Deve ser chamado diariamente (ex: Netlify Scheduled Function ou cron externo).
 * Para cada cobrança PENDING com due_date < hoje:
 * 1. Consulta o status real na API Efí
 * 2. Atualiza o banco se foi paga ou cancelada
 * 3. Marca como OVERDUE se ainda pendente
 */
export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET || 'cobrancapro-cron';

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Busca cobranças pendentes com vencimento passado
    const { data: charges, error } = await supabaseAdmin
      .from('charges')
      .select('id, external_id, provider, due_date, status')
      .eq('status', 'PENDING')
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let updated = 0;
    let overdue = 0;

    for (const charge of charges || []) {
      if (!charge.external_id || charge.external_id.startsWith('local-')) {
        // Cobrança local sem ID externo — apenas marca como vencida
        await supabaseAdmin
          .from('charges')
          .update({ status: 'OVERDUE' })
          .eq('id', charge.id);
        overdue++;
        continue;
      }

      if (charge.provider === 'EFI') {
        const newStatus = await sincronizarStatusCharge(charge.id, charge.external_id);
        if (newStatus !== 'PENDING') updated++;
        else {
          await supabaseAdmin
            .from('charges')
            .update({ status: 'OVERDUE' })
            .eq('id', charge.id);
          overdue++;
        }
      } else {
        await supabaseAdmin
          .from('charges')
          .update({ status: 'OVERDUE' })
          .eq('id', charge.id);
        overdue++;
      }
    }

    return NextResponse.json({
      success: true,
      checked: charges?.length || 0,
      updated,
      overdue,
      date: today,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
