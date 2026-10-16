import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const atendimentoId = searchParams.get('atendimento_id');

  if (!atendimentoId) {
    return NextResponse.json({ error: 'atendimento_id required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('at_mensagens')
    .select('*')
    .eq('atendimento_id', atendimentoId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
