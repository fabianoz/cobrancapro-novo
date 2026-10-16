import { NextResponse } from 'next/server';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';
const INSTANCE = 'atendimento';

export async function GET() {
  try {
    const r = await fetch(`${EVO_URL}/instance/connect/${INSTANCE}`, {
      headers: { apikey: EVO_KEY },
    });

    if (!r.ok) {
      const errText = await r.text();
      return NextResponse.json(
        { status: 'error', base64: '', error: `Evolution API ${r.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await r.json();

    if (data.instance?.state === 'open' || data.instance?.state === 'connected') {
      return NextResponse.json({
        status: 'open',
        base64: '',
        phoneNumber: data.instance.wid?.split(':')[0] || data.instance.phone || '',
        instanceName: data.instance.name || INSTANCE,
      });
    }

    const qrBase64 = data.base64 || data.qrcode?.base64 || data.qrcode?.code || '';
    if (qrBase64) {
      return NextResponse.json({
        status: 'connecting',
        base64: qrBase64,
        instanceName: INSTANCE,
      });
    }

    return NextResponse.json({
      status: data.instance?.state || data.status || 'close',
      base64: '',
      instanceName: INSTANCE,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: 'error', base64: '', error: msg }, { status: 500 });
  }
}
