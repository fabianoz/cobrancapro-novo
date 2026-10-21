export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';

function errorResponse(message = 'Não foi possível concluir a operação.') {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'queue';
  const search = searchParams.get('search')?.trim() || '';
  const team = searchParams.get('team') || '';
  const userId = searchParams.get('user_id') || '';
  const empresaId = searchParams.get('empresa_id') || '';

  let query = supabaseAdmin.from('chat_conversas').select('*').order('updated_at', { ascending: false });
  if (empresaId) query = query.eq('empresa_id', empresaId);
  if (view === 'queue') query = query.in('status', ['aberto', 'em_atendimento']).is('responsavel_id', null);
  if (view === 'mine' && userId) query = query.eq('responsavel_id', userId).neq('status', 'encerrado');
  if (view === 'team' && team) query = query.eq('equipe', team).neq('status', 'encerrado');
  if (view === 'closed') query = query.eq('status', 'encerrado');
  if (search) query = query.or(`nome.ilike.%${search}%,telefone.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Não foi possível carregar as conversas.' }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json();
    const { action, conversationId, userId, team } = body as {
      action?: string;
      conversationId?: string;
      userId?: string;
      team?: string;
    };

    if (!conversationId) return errorResponse('Conversa não encontrada.');

    if (action === 'assume') {
      if (!userId) return errorResponse('Usuário não informado.');
      const { data, error } = await supabaseAdmin
        .from('chat_conversas')
        .update({ responsavel_id: userId, status: 'em_atendimento', updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .is('responsavel_id', null)
        .select()
        .maybeSingle();
      if (error) return NextResponse.json({ error: 'Não foi possível assumir a conversa.' }, { status: 500 });
      if (!data) return errorResponse('Essa conversa já foi assumida por outra pessoa.');
      return NextResponse.json(data);
    }

    if (action === 'transfer') {
      if (!team || !['atendimento', 'financeiro', 'administrativo', 'franquia'].includes(team)) return errorResponse('Equipe inválida.');
      const { data, error } = await supabaseAdmin
        .from('chat_conversas')
        .update({ equipe: team, responsavel_id: null, status: 'aberto', transferida: true, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .select()
        .maybeSingle();
      if (error || !data) return NextResponse.json({ error: 'Não foi possível transferir a conversa.' }, { status: 500 });
      return NextResponse.json(data);
    }

    if (action === 'close' || action === 'reopen') {
      const status = action === 'close' ? 'encerrado' : 'aberto';
      const { data, error } = await supabaseAdmin
        .from('chat_conversas')
        .update({ status, responsavel_id: action === 'close' ? null : userId || null, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .select()
        .maybeSingle();
      if (error || !data) return NextResponse.json({ error: 'Não foi possível atualizar a conversa.' }, { status: 500 });
      return NextResponse.json(data);
    }

    if (action === 'read') {
      const { error } = await supabaseAdmin.from('chat_conversas').update({ nao_lidas: 0 }).eq('id', conversationId);
      if (error) return NextResponse.json({ error: 'Não foi possível marcar as mensagens.' }, { status: 500 });
      await supabaseAdmin.from('chat_mensagens').update({ lida: true }).eq('conversa_id', conversationId).eq('remetente', 'cliente');
      return NextResponse.json({ success: true });
    }

    return errorResponse('Ação inválida.');
  } catch {
    return NextResponse.json({ error: 'Não foi possível concluir a operação.' }, { status: 500 });
  }
}
