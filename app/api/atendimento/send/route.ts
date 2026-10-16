import { NextResponse } from 'next/server';
import { formatBrazilianPhone } from '@/lib/whatsapp';
import { supabaseAdmin } from '@/lib/supabase';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';
const INSTANCE = 'atendimento';

export async function POST(request: Request) {
  try {
    const { atendimento_id, mensagem, atendente_id } = await request.json();

    if (!atendimento_id || !mensagem) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { data: atendimento } = await supabaseAdmin
      .from('at_atendimentos')
      .select('numero_cliente')
      .eq('id', atendimento_id)
      .maybeSingle();

    if (!atendimento) {
      return NextResponse.json({ error: 'Atendimento nao encontrado' }, { status: 404 });
    }

    const fullPhone = formatBrazilianPhone(atendimento.numero_cliente);

    const response = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: fullPhone, text: mensagem }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Evolution API ${response.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    await supabaseAdmin.from('at_mensagens').insert({
      atendimento_id,
      direcao: 'saida',
      mensagem,
      atendente_id: atendente_id || null,
    });

    await supabaseAdmin
      .from('at_atendimentos')
      .update({ ultima_mensagem: mensagem, updated_at: new Date().toISOString() })
      .eq('id', atendimento_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
