export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/api'

function getConfig() {
  return {
    apiUrl: process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL || '',
    apiKey: process.env.EVOLUTION_API_KEY || process.env.WHATSAPP_API_KEY || '',
    instance: process.env.WHATSAPP_INSTANCE || 'cobrancapro'
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()

    console.log('[WhatsApp Webhook] Evento:', body.event || body.type)

    const event = body.event || body.type
    const instance = body.instance

    // Ignorar eventos que nao sao mensagens
    if (!event?.includes('MESSAGES') && !event?.includes('messages')) {
      if (event?.includes('CONNECTION')) {
        console.log('[WhatsApp] Status conexao:', body.data?.state || body.state)
      }
      return NextResponse.json({ received: true })
    }

    // Evolution API - Formato messages.upsert
    const data = body.data || body
    const messages = data.messages || [data]
    const messageData = messages[0]

    if (!messageData) return NextResponse.json({ received: true })

    // Ignorar mensagens enviadas por nos mesmos
    if (messageData.key?.fromMe === true) {
      return NextResponse.json({ received: true, ignored: 'fromMe' })
    }

    // Extrair telefone e mensagem
    const remoteJid = messageData.key?.remoteJid || data.key?.remoteJid || ''
    if (remoteJid.includes('@g.us')) {
      return NextResponse.json({ received: true, ignored: 'group' })
    }

    const telefoneRaw = remoteJid.replace('@s.whatsapp.net', '')
    const numeroLimpo = telefoneRaw.replace(/\D/g, '')

    // Extrair texto da mensagem (varios formatos possiveis)
    const msgContent = messageData.message || data.message || {}
    const texto =
      msgContent.conversation ||
      msgContent.extendedTextMessage?.text ||
      msgContent.imageMessage?.caption ||
      msgContent.videoMessage?.caption ||
      msgContent.buttonsResponseMessage?.selectedButtonId ||
      msgContent.listResponseMessage?.singleSelectReply?.selectedRowId ||
      ''

    if (!texto || !numeroLimpo) {
      return NextResponse.json({ received: true, ignored: 'no text or number' })
    }

    const nomeContato = data.pushName || messageData.pushName || telefoneRaw

    console.log(`[WhatsApp] Mensagem de ${numeroLimpo} (${nomeContato}): ${texto.substring(0, 100)}`)

    // 1. Buscar cliente pelo telefone (tenta varias variacoes)
    const variacoesTelefone = [
      numeroLimpo,
      numeroLimpo.replace(/^55/, ''),
      numeroLimpo.slice(-11),
      numeroLimpo.slice(-10)
    ]

    let cliente: { id: string; name: string; whatsapp: string | null } | null = null
    for (const tel of variacoesTelefone) {
      const { data: c } = await supabase
        .from('customers')
        .select('id, name, whatsapp')
        .or(`whatsapp.ilike.%${tel}%`)
        .limit(1)
        .maybeSingle()
      if (c) { cliente = c; break }
    }

    // 2. Verificar se ja existe atendimento aberto para esse numero
    const { data: atendimentoAberto } = await supabase
      .from('atendimentos')
      .select('id, status')
      .eq('telefone', numeroLimpo)
      .in('status', ['aberto', 'em_atendimento'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let atendimentoId: string

    if (atendimentoAberto) {
      atendimentoId = atendimentoAberto.id
      await supabase.from('atendimentos').update({
        ultima_mensagem: texto,
        nome_contato: nomeContato,
        cliente_id: cliente?.id || undefined,
        updated_at: new Date().toISOString(),
        tem_mensagem_nova: true
      }).eq('id', atendimentoId)
    } else {
      const { data: novo, error } = await supabase
        .from('atendimentos')
        .insert({
          telefone: numeroLimpo,
          nome_contato: nomeContato,
          cliente_id: cliente?.id || null,
          status: 'aberto',
          origem: 'whatsapp',
          ultima_mensagem: texto,
          tem_mensagem_nova: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('[WhatsApp] Erro criar atendimento:', error)
        throw error
      }
      atendimentoId = novo.id
      console.log(`[WhatsApp] Novo atendimento criado: ${atendimentoId}`)
    }

    // 3. Salvar mensagem
    const { error: errMsg } = await supabase
      .from('mensagens_atendimento')
      .insert({
        atendimento_id: atendimentoId,
        mensagem: texto,
        tipo: 'cliente',
        telefone: numeroLimpo,
        nome_contato: nomeContato,
        raw_payload: body,
        created_at: new Date().toISOString()
      })

    if (errMsg) console.error('[WhatsApp] Erro salvar mensagem:', errMsg)

    // 4. Salvar log
    await supabase.from('whatsapp_logs').insert({
      cliente_id: cliente?.id || null,
      telefone: numeroLimpo,
      mensagem: texto,
      tipo: 'recebido',
      status: 'recebido',
      atendimento_id: atendimentoId,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({ success: true, atendimento_id: atendimentoId })

  } catch (e: any) {
    console.error('[WhatsApp Webhook] Erro:', e)
    return NextResponse.json({ error: e.message, received: true }, { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Webhook WhatsApp CobrancaPro ativo',
    endpoints: {
      webhook: '/api/atendimento/whatsapp/webhook',
      mensagens: '/api/atendimento/mensagens'
    },
    timestamp: new Date().toISOString()
  })
}
