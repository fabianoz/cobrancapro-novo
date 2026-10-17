export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';

async function getInstanceName(): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from('settings')
    .select('evolution_instance_atendimento')
    .eq('id', 1)
    .maybeSingle();
  return data?.evolution_instance_atendimento || 'bot-atendimento';
}

export async function GET() {
    const supabaseAdmin = getSupabaseAdmin();
  const instance = await getInstanceName();
  try {
    const response = await fetch(`${EVO_URL}/instance/connectionState/${instance}`, {
      headers: { apikey: EVO_KEY },
    });
    if (!response.ok) return NextResponse.json({ status: 'close', instanceName: instance });
    const data = await response.json();
    const state = data.instance?.state || data.state || data.status || 'close';
    let phoneNumber = '';
    if (state === 'open' || state === 'connected') {
      phoneNumber = data.instance?.wid?.split(':')[0] || data.instance?.phone || '';
      await supabaseAdmin
        .from('settings')
        .update({ evolution_atendimento_status: 'open', evolution_atendimento_numero: phoneNumber })
        .eq('id', 1);
    } else {
      await supabaseAdmin
        .from('settings')
        .update({ evolution_atendimento_status: state })
        .eq('id', 1);
    }
    return NextResponse.json({ status: state, phoneNumber, instanceName: instance });
  } catch {
    return NextResponse.json({ status: 'close', instanceName: instance });
  }
}
