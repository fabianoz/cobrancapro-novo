import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('evolution_instance_atendimento, chat_roteamento_modo, chat_mensagem_triagem, chat_instancia_suporte, chat_instancia_financeiro, chat_instancia_vendas')
      .eq('id', 1)
      .maybeSingle();
    if (!data) {
      return NextResponse.json({
        instance: 'bot-atendimento',
        routingMode: 'single',
        triageMessage: 'Digite 1-Financeiro 2-Suporte 3-Vendas',
        instanceSuporte: '',
        instanceFinanceiro: '',
        instanceVendas: '',
      });
    }
    return NextResponse.json({
      instance: data.evolution_instance_atendimento || 'bot-atendimento',
      routingMode: data.chat_roteamento_modo || 'single',
      triageMessage: data.chat_mensagem_triagem || 'Digite 1-Financeiro 2-Suporte 3-Vendas',
      instanceSuporte: data.chat_instancia_suporte || '',
      instanceFinanceiro: data.chat_instancia_financeiro || '',
      instanceVendas: data.chat_instancia_vendas || '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      instance?: string;
      routingMode?: string;
      triageMessage?: string;
      instanceSuporte?: string;
      instanceFinanceiro?: string;
      instanceVendas?: string;
    };
    const routingMode = body.routingMode === 'multi' ? 'multi' : 'single';
    await supabaseAdmin
      .from('settings')
      .update({
        evolution_instance_atendimento: body.instance || 'bot-atendimento',
        chat_roteamento_modo: routingMode,
        chat_mensagem_triagem: body.triageMessage || 'Digite 1-Financeiro 2-Suporte 3-Vendas',
        chat_instancia_suporte: body.instanceSuporte || null,
        chat_instancia_financeiro: body.instanceFinanceiro || null,
        chat_instancia_vendas: body.instanceVendas || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
