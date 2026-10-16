import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';

async function getInstanceName(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('evolution_instance_atendimento')
    .eq('id', 1)
    .maybeSingle();
  return data?.evolution_instance_atendimento || 'bot-atendimento';
}

export async function GET(request: Request) {
  const instance = await getInstanceName();
  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}/api/webhooks/evolution-suporte`;

  try {
    const response = await fetch(`${EVO_URL}/webhook/set/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({
        webhook: {
          url: webhookUrl,
          enabled: true,
          events: ['MESSAGES_UPSERT'],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { success: false, error: `Evolution API retornou ${response.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      instance,
      webhookUrl,
      evolutionResponse: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
