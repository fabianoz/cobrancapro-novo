export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';

type BillingProvider = 'EFI' | 'INTER' | 'ASAAS';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = body.provider as BillingProvider;
    const empresaId = typeof body.empresaId === 'string' && body.empresaId ? body.empresaId : null;

    if (!['EFI', 'INTER', 'ASAAS'].includes(provider)) {
      return NextResponse.json({ success: false, error: 'Banco inválido' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let data: { billing_provider: string | null } | null = null;
    let error: unknown = null;
    if (empresaId) {
      const { data: upsertData, error: upsertError } = await supabaseAdmin
        .from('empresa_settings')
        .upsert({ billing_provider: provider, empresa_id: empresaId, updated_at: new Date().toISOString() }, { onConflict: 'empresa_id' })
        .select('billing_provider')
        .maybeSingle();
      data = upsertData;
      error = upsertError;
    } else {
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from('settings')
        .update({ billing_provider: provider, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select('billing_provider')
        .maybeSingle();
      data = updateData;
      error = updateError;
    }

    if (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao salvar banco';
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }

    if (data?.billing_provider !== provider) {
      return NextResponse.json({ success: false, error: 'O banco não foi ativado' }, { status: 500 });
    }

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível ativar o banco';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
