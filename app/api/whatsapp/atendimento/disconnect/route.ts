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

export async function POST() {
    const supabaseAdmin = getSupabaseAdmin();
  const instance = await getInstanceName();
  try {
    const response = await fetch(`${EVO_URL}/instance/logout/${instance}`, {
      method: 'DELETE',
      headers: { apikey: EVO_KEY },
    });
    if (!response.ok && response.status !== 400) {
      const errText = await response.text();
      return NextResponse.json({ error: `Erro ao desconectar: ${response.status} ${errText.slice(0, 200)}` }, { status: 502 });
    }
    await supabaseAdmin.from('settings').update({ evolution_atendimento_status: 'close', evolution_atendimento_numero: null }).eq('id', 1);
    return NextResponse.json({ success: true, status: 'close' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
    const supabaseAdmin = getSupabaseAdmin();
  return POST();
}
