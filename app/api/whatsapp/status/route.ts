import { NextResponse } from 'next/server';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';
const INSTANCE = 'bot-ia';

export async function GET() {
  try {
    const r = await fetch(`${EVO_URL}/instance/connectionState/${INSTANCE}`, {
      headers: { apikey: EVO_KEY },
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('[WhatsApp Status] Evolution error:', r.status, errText);
      return NextResponse.json({ status: 'close' }, { status: 200 });
    }

    const data = await r.json();
    const state = data.instance?.state || data.state || data.status || 'close';

    let phoneNumber = '';
    if (state === 'open' || state === 'connected') {
      // Try to get phone from the state response itself
      phoneNumber = data.instance?.wid?.split(':')[0] || data.instance?.phone || '';
    }

    return NextResponse.json({
      status: state,
      phoneNumber,
      instanceName: INSTANCE,
    });
  } catch {
    return NextResponse.json({ status: 'close' });
  }
}
