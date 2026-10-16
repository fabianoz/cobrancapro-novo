import { NextResponse } from 'next/server';
import { formatBrazilianPhone } from '@/lib/whatsapp';
import { supabaseAdmin } from '@/lib/supabase';

const EVO_URL = 'https://evolution-api-production-56f2.up.railway.app';
const EVO_KEY = 'FABIANO123';
const INSTANCE = 'atendimento';

async function sendText(phone: string, text: string): Promise<boolean> {
  const fullPhone = formatBrazilianPhone(phone);
  try {
    const r = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number: fullPhone, text }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Evolution API webhook payload for incoming message
    const message = body?.message;
    const from = message?.key?.remoteJid || body?.key?.remoteJid || '';
    const text = message?.message?.conversation ||
      message?.message?.extendedTextMessage?.text ||
      body?.message?.conversation ||
      '';

    // Only process messages from chat (not groups), ignore messages from ourselves
    if (!from || !from.endsWith('@s.whatsapp.net') || !text) {
      return NextResponse.json({ success: true, ignored: true });
    }

    // Ignore messages sent by us (fromMe)
    const fromMe = message?.key?.fromMe || body?.key?.fromMe || false;
    if (fromMe) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const phoneNumber = from.replace('@s.whatsapp.net', '');
    const pushName = message?.pushName || body?.pushName || '';

    // Check if there's an existing open atendimento for this number
    const { data: existing } = await supabaseAdmin
      .from('at_atendimentos')
      .select('id, status, setor_id')
      .eq('numero_cliente', phoneNumber)
      .in('status', ['aguardando', 'em_atendimento'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Add the message to the existing atendimento
      await supabaseAdmin.from('at_mensagens').insert({
        atendimento_id: existing.id,
        direcao: 'entrada',
        mensagem: text,
      });

      await supabaseAdmin
        .from('at_atendimentos')
        .update({ ultima_mensagem: text, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      return NextResponse.json({ success: true, atendimento_id: existing.id });
    }

    // New atendimento — check active setores
    const { data: setoresAtivos } = await supabaseAdmin
      .from('at_setores')
      .select('id, nome, ordem')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (!setoresAtivos || setoresAtivos.length === 0) {
      return NextResponse.json({ success: true, ignored: true });
    }

    // If only one setor active, create atendimento directly with that setor
    if (setoresAtivos.length === 1) {
      const setor = setoresAtivos[0];
      const { data: newAtt } = await supabaseAdmin
        .from('at_atendimentos')
        .insert({
          numero_cliente: phoneNumber,
          nome_cliente: pushName,
          setor_id: setor.id,
          status: 'aguardando',
          ultima_mensagem: text,
        })
        .select()
        .maybeSingle();

      if (newAtt) {
        await supabaseAdmin.from('at_mensagens').insert({
          atendimento_id: newAtt.id,
          direcao: 'entrada',
          mensagem: text,
        });
      }

      return NextResponse.json({ success: true, atendimento_id: newAtt?.id });
    }

    // Multiple setores active — check if the message is a number selection (1, 2, 3...)
    const trimmed = text.trim();
    const selectionNum = parseInt(trimmed, 10);
    if (!isNaN(selectionNum) && selectionNum >= 1 && selectionNum <= setoresAtivos.length) {
      const setor = setoresAtivos[selectionNum - 1];
      const { data: newAtt } = await supabaseAdmin
        .from('at_atendimentos')
        .insert({
          numero_cliente: phoneNumber,
          nome_cliente: pushName,
          setor_id: setor.id,
          status: 'aguardando',
          ultima_mensagem: text,
        })
        .select()
        .maybeSingle();

      if (newAtt) {
        await supabaseAdmin.from('at_mensagens').insert({
          atendimento_id: newAtt.id,
          direcao: 'entrada',
          mensagem: text,
        });

        await sendText(phoneNumber, `Voce foi direcionado para o setor *${setor.nome}*. Aguarde enquanto um atendente assume o atendimento.`);
      }

      return NextResponse.json({ success: true, atendimento_id: newAtt?.id });
    }

    // Multiple setores — send menu
    const menuText = setoresAtivos
      .map((s, i) => `${i + 1} - ${s.nome}`)
      .join('\n');

    await sendText(phoneNumber, `Bem-vindo! Escolha o setor desejado:\n\n${menuText}\n\nDigite o numero correspondente.`);

    return NextResponse.json({ success: true, menu_sent: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Atendimento Webhook] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
