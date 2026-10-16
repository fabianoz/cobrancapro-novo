import { NextResponse } from 'next/server';
import { formatBrazilianPhone } from '@/lib/whatsapp';

export async function POST(request: Request) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json({ error: 'Missing phone or message' }, { status: 400 });
    }

    // Hardcoded Evolution API config for bot-ia instance
    const url = 'https://evolution-api-production-56f2.up.railway.app';
    const apiKey = 'FABIANO123';
    const instance = 'bot-ia';

    if (!url) {
      return NextResponse.json(
        { error: 'Evolution API URL não configurada. Configure na página do WhatsApp.' },
        { status: 503 }
      );
    }

    const fullPhone = formatBrazilianPhone(phone);

    // Check connection state before sending
    const stateRes = await fetch(`${url}/instance/connectionState/${instance}`, {
      headers: { apikey: apiKey },
    });
    let connected = false;
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      const state = stateData.instance?.state;
      connected = state === 'open' || state === 'connected';
    }

    if (!connected) {
      return NextResponse.json(
        { error: 'WhatsApp nao esta conectado. Acesse a pagina do WhatsApp para escanear o QR Code e conectar.' },
        { status: 503 }
      );
    }

    const endpoint = `${url}/message/sendText/${instance}`;

    console.log(`[WhatsApp Send] POST ${endpoint}`);
    console.log(`[WhatsApp Send] Phone: ${phone} -> ${fullPhone}`);
    console.log(`[WhatsApp Send] Instance: ${instance}`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: fullPhone,
          text: message,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[WhatsApp Send] Evolution API error: ${response.status} ${errText}`);

        // 500 with "Connection Closed" = WhatsApp disconnected mid-send
        if (response.status === 500 && errText.includes('Connection Closed')) {
          return NextResponse.json(
            { error: 'WhatsApp foi desconectado. Acesse a pagina do WhatsApp para reconectar via QR Code.' },
            { status: 503 }
          );
        }

        return NextResponse.json(
          {
            error: `Evolution API retornou ${response.status}: ${errText.slice(0, 500)}`,
            details: errText,
          },
          { status: 502 }
        );
      }

      console.log('[WhatsApp Send] Message sent successfully');
      return NextResponse.json({ success: true });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error('[WhatsApp Send] Fetch error:', msg);
      return NextResponse.json(
        { error: `Erro de conexao com Evolution API: ${msg}` },
        { status: 502 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
