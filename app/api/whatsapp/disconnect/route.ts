export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';
const INSTANCE = 'bot-ia';

export async function POST() {
  try {
    const r = await fetch(`${EVO_URL}/instance/logout/${INSTANCE}`, {
      method: 'DELETE',
      headers: { apikey: EVO_KEY },
    });

    // 400 = instance already disconnected — treat as success
    if (!r.ok && r.status !== 400) {
      const errText = await r.text();
      console.error('[WhatsApp Logout] Evolution error:', r.status, errText);
      return NextResponse.json(
        { error: `Erro ao desconectar: ${r.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, status: 'close' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[WhatsApp Logout] Fetch error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  return POST();
}
