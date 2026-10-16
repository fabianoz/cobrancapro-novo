import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.apiKey && typeof body.apiKey === 'string' && body.apiKey.trim().length > 5) {
      update.asaas_api_key = body.apiKey.trim();
    }
    if (body.sandbox !== undefined) {
      update.asaas_sandbox = !!body.sandbox;
    }

    const { error } = await supabaseAdmin.from('settings').update(update).eq('id', 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
