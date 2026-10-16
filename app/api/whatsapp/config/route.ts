import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
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
