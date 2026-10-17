export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';

export async function GET() {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('evolution_api_url, evolution_api_key, evolution_instance_name')
      .eq('id', 1)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({
        url: '',
        apiKey: '',
        instance: 'cobrancapro',
      });
    }

    return NextResponse.json({
      url: data.evolution_api_url || '',
      apiKey: data.evolution_api_key || '',
      instance: data.evolution_instance_name || 'cobrancapro',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const { url, apiKey, instance } = await request.json();

    await supabaseAdmin
      .from('settings')
      .update({
        evolution_api_url: url,
        evolution_api_key: apiKey,
        evolution_instance_name: instance || 'cobrancapro',
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
