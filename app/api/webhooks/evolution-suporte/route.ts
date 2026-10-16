import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';

function extractMessageData(body: Record<string, unknown>): {
  remoteJid: string;
  fromMe: boolean;
  text: string;
  pushName: string;
} {
  const data = (body.data || body) as Record<string, unknown>;
  const key = (data.key || body.key || {}) as Record<string, unknown>;
  const message = (data.message || body.message || {}) as Record<string, unknown>;
  const remoteJid = String(key.remoteJid || data.remoteJid || body.remoteJid || '');
  const fromMe = Boolean(key.fromMe || data.fromMe || false);
  const pushName = String(data.pushName || body.pushName || 'Cliente WhatsApp');

  const text = String(
    message.conversation ||
    (message.extendedTextMessage as Record<string, unknown> | undefined)?.text ||
    (message.imageMessage as Record<string, unknown> | undefined)?.caption ||
    (message.videoMessage as Record<string, unknown> | undefined)?.caption ||
    data.conversation ||
    body.conversation ||
    ''
  ).trim();

  return { remoteJid, fromMe, text, pushName };
}

async function sendText(phone: string, text: string): Promise<void> {
  try {
    await fetch(`${EVO_URL}/message/sendText/bot-atendimento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: phone, text }),
    });
  } catch (e) {
    console.log('Erro sendText', e);
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', webhook: 'evolution-suporte ativo' });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    console.log('[Webhook] Body recebido:', JSON.stringify(body).slice(0, 500));

    const event = String(body.event || '').toLowerCase();
    if (event && event !== 'messages.upsert' && event !== 'messages_upsert') {
      return NextResponse.json({ success: true, ignored: 'evento ' + event });
    }

    const { remoteJid, fromMe, text, pushName } = extractMessageData(body);

    console.log('[Webhook] Parsed:', { remoteJid, fromMe, text, pushName });

    if (fromMe) return NextResponse.json({ success: true, ignored: 'fromMe' });
    if (!remoteJid) return NextResponse.json({ success: true, ignored: 'sem remoteJid' });
    if (!remoteJid.includes('@s.whatsapp.net') && !remoteJid.includes('@c.us')) {
      return NextResponse.json({ success: true, ignored: 'nao eh whatsapp.net ' + remoteJid });
    }
    if (!text) return NextResponse.json({ success: true, ignored: 'sem texto' });

    const telefone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');

    const { data: existing } = await supabaseAdmin
      .from('chat_conversas')
      .select('id, nao_lidas')
      .eq('telefone', telefone)
      .neq('status', 'encerrado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from('chat_mensagens').insert({
        conversa_id: existing.id,
        texto: text,
        remetente: 'cliente',
        estado_entrega: 'enviada',
      });
      await supabaseAdmin.from('chat_conversas').update({
        ultima_mensagem: text,
        ultimo_visto: new Date().toISOString(),
        nao_lidas: (existing.nao_lidas || 0) + 1,
        status: 'aberto',
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);

      console.log('[Webhook] Atualizado existente:', existing.id);
      return NextResponse.json({ success: true, conversa_id: existing.id });
    }

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, name, email')
      .ilike('whatsapp', `%${telefone.slice(-8)}%`)
      .maybeSingle();

    const { data: nova, error } = await supabaseAdmin.from('chat_conversas').insert({
      cliente_id: customer?.id || null,
      nome: customer?.name || pushName,
      email: customer?.email || null,
      telefone,
      status: 'aberto',
      equipe: 'atendimento',
      ultima_mensagem: text,
      ultimo_visto: new Date().toISOString(),
      nao_lidas: 1,
    }).select().single();

    if (error) {
      console.error('[Webhook] Erro ao criar conversa:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from('chat_mensagens').insert({
      conversa_id: nova!.id,
      texto: text,
      remetente: 'cliente',
    });

    console.log('[Webhook] Nova conversa criada:', nova!.id);
    return NextResponse.json({ success: true, conversa_id: nova!.id });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Webhook] Erro geral:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
