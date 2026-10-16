import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { testAsaasConnection } from '@/lib/asaas/client';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.apiKey && typeof body.apiKey === 'string' && body.apiKey.trim().length > 5) {
      await supabaseAdmin
        .from('settings')
        .update({ asaas_api_key: body.apiKey.trim(), updated_at: new Date().toISOString() })
        .eq('id', 1);
    }

    if (body.sandbox !== undefined) {
      await supabaseAdmin
        .from('settings')
        .update({ asaas_sandbox: !!body.sandbox, updated_at: new Date().toISOString() })
        .eq('id', 1);
    }

    const result = await testAsaasConnection();

    return NextResponse.json({
      success: true,
      message: `Conexão OK — ambiente: ${result.environment} | Conta: ${result.accountEmail}`,
      environment: result.environment,
      accountEmail: result.accountEmail,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
