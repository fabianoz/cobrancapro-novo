export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const remoteJid = body?.data?.key?.remoteJid
    const messageContent = body?.data?.message?.conversation || body?.data?.message?.extendedTextMessage?.text || ''
    
    if (!remoteJid || remoteJid.includes('@g.us')) {
      return NextResponse.json({ ok: true })
    }

    const numero = remoteJid.replace('@s.whatsapp.net', '')

    // Cria ou atualiza atendimento
    const { data: existente } = await supabaseAdmin
      .from('atendimentos')
      .select('id, status')
      .eq('cliente_numero', numero)
      .in('status', ['waiting', 'in_progress'])
      .maybeSingle()

    if (!existente) {
      await supabaseAdmin.from('atendimentos').insert({
        cliente_numero: numero,
        ultima_mensagem: messageContent,
        status: 'waiting',
        setor: 'suporte',
        created_at: new Date().toISOString()
      })
    } else {
      await supabaseAdmin.from('atendimentos').update({
        ultima_mensagem: messageContent,
        updated_at: new Date().toISOString()
      }).eq('id', existente.id)
    }

    // Salva mensagem
    await supabaseAdmin.from('mensagens_atendimento').insert({
      atendimento_id: existente?.id,
      cliente_numero: numero,
      mensagem: messageContent,
      de: 'cliente',
      created_at: new Date().toISOString()
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.log('webhook error', e.message)
    return NextResponse.json({ ok: true })
  }
}
