export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/api'

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin()
  try {
    const body = await request.json()
    const remoteJid = body?.data?.key?.remoteJid
    const messageContent = body?.data?.message?.conversation || body?.data?.message?.extendedTextMessage?.text || ''
    
    if (!remoteJid || remoteJid.includes('@g.us')) {
      return NextResponse.json({ ok: true })
    }

    const numero = remoteJid.replace('@s.whatsapp.net', '')

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

    await supabaseAdmin.from('mensagens_atendimento').insert({
      atendimento_id: existente?.id,
      cliente_numero: numero,
      mensagem: messageContent,
      de: 'cliente',
      created_at: new Date().toISOString()
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.log('webhook error', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ ok: true })
  }
}
