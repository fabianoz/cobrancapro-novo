export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';

async function registerWebhook(instance: string, webhookUrl: string): Promise<void> {
  try {
    await fetch(`${EVO_URL}/webhook/set/${instance}`, {
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
  } catch {
    // non-critical — the instance still connects without webhook
  }
}

async function getInstanceName(): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from('settings')
    .select('evolution_instance_atendimento')
    .eq('id', 1)
    .maybeSingle();
  return data?.evolution_instance_atendimento || 'bot-atendimento';
}

async function ensureInstance(instance: string): Promise<boolean> {
  try {
    const response = await fetch(`${EVO_URL}/instance/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ instanceName: instance, integration: 'WHATSAPP-BAILEYS' }),
    });
    return response.ok || response.status === 409;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  const instance = await getInstanceName();
  await ensureInstance(instance);

  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}/api/webhooks/evolution-suporte`;
  await registerWebhook(instance, webhookUrl);

  try {
    const response = await fetch(`${EVO_URL}/instance/connect/${instance}`, {
      headers: { apikey: EVO_KEY },
    });
    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ status: 'error', base64: '', error: `Evolution API ${response.status}: ${errText.slice(0, 300)}` }, { status: 502 });
    }
    const data = await response.json();
    if (data.instance?.state === 'open' || data.instance?.state === 'connected') {
      const phoneNumber = data.instance.wid?.split(':')[0] || data.instance.phone || '';
      await supabaseAdmin.from('settings').update({ evolution_atendimento_status: 'open', evolution_atendimento_numero: phoneNumber }).eq('id', 1);
      return NextResponse.json({ status: 'open', base64: '', phoneNumber, instanceName: instance, webhookUrl });
    }
    const qrBase64 = data.base64 || data.qrcode?.base64 || data.qrcode?.code || '';
    if (qrBase64) {
      await supabaseAdmin.from('settings').update({ evolution_atendimento_status: 'connecting' }).eq('id', 1);
      return NextResponse.json({ status: 'connecting', base64: qrBase64, instanceName: instance, webhookUrl });
    }
    return NextResponse.json({ status: data.instance?.state || data.status || 'close', base64: '', instanceName: instance, webhookUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: 'error', base64: '', error: message }, { status: 500 });
  }
}
