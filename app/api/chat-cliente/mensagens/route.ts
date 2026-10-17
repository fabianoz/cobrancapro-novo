export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';
import { sendWhatsAppTextAtendimento } from '@/lib/whatsapp';

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversa_id');
  if (!conversationId) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('chat_mensagens')
    .select('*')
    .eq('conversa_id', conversationId)
    .order('data_hora', { ascending: true });
  if (error) return NextResponse.json({ error: 'Não foi possível carregar as mensagens.' }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json();
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const attendantId = typeof body.attendantId === 'string' ? body.attendantId : null;
    if (!conversationId || !text) return NextResponse.json({ error: 'Mensagem inválida.' }, { status: 400 });

    const { data: conversation } = await supabaseAdmin
      .from('chat_conversas')
      .select('id, telefone, status')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conversation) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 });
    if (conversation.status === 'encerrado') return NextResponse.json({ error: 'Reabra a conversa para responder.' }, { status: 409 });

    const sent = await sendWhatsAppTextAtendimento(conversation.telefone, text);
    const { data: message, error } = await supabaseAdmin.from('chat_mensagens').insert({
      conversa_id: conversationId,
      texto: text,
      remetente: 'atendente',
      atendente_id: attendantId,
      estado_entrega: sent ? 'enviada' : 'erro',
      lida: true,
    }).select().maybeSingle();
    if (error || !message) return NextResponse.json({ error: 'Não foi possível salvar a mensagem.' }, { status: 500 });

    await supabaseAdmin.from('chat_conversas').update({ ultima_mensagem: text, ultimo_visto: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', conversationId);
    if (!sent) return NextResponse.json({ error: 'O WhatsApp do suporte não está conectado.', message }, { status: 502 });
    return NextResponse.json(message);
  } catch {
    return NextResponse.json({ error: 'Não foi possível enviar a mensagem.' }, { status: 500 });
  }
}
