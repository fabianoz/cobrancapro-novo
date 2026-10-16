import { NextResponse } from 'next/server';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';
const INSTANCE = 'atendimento';

export async function POST() {
  try {
    const r = await fetch(`${EVO_URL}/instance/logout/${INSTANCE}`, {
      method: 'DELETE',
      headers: { apikey: EVO_KEY },
    });

    if (!r.ok && r.status !== 400) {
      const errText = await r.text();
      return NextResponse.json(
        { error: `Erro ao desconectar: ${r.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, status: 'close' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
