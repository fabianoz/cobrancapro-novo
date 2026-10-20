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

    if (!['EFI', 'INTER', 'ASAAS'].includes(provider)) {
      return NextResponse.json({ success: false, error: 'Banco inválido' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('settings')
      .update({ billing_provider: provider, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select('billing_provider')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
