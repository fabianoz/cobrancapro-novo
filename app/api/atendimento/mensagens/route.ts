export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/api'
import { sendWhatsAppTextAtendimento } from '@/lib/whatsapp'

function getConfig() {
  return {
    apiUrl: process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL || '',
    apiKey: process.env.EVOLUTION_API_KEY || process.env.WHATSAPP_API_KEY || '',
    instance: process.env.WHATSAPP_INSTANCE || 'cobrancapro'
  }
}

// ENVIAR MENSAGEM NO ATENDIMENTO (ATENDENTE -> CLIENTE)
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()
    const { atendimento_id, mensagem, atendente_id, enviar_whatsapp = true } = body

    if (!atendimento_id || !mensagem) {
      return NextResponse.json({ error: 'atendimento_id e mensagem obrigatorios' }, { status: 400 })
    }

    // Buscar atendimento
    const { data: atendimento, error: errAt } = await supabase
      .from('atendimentos')
      .select('telefone, cliente_id, status')
      .eq('id', atendimento_id)
      .single()

    if (errAt) throw errAt

    if (atendimento.status === 'encerrado') {
      return NextResponse.json({ error: 'Atendimento encerrado. Reabra para responder.' }, { status: 409 })
    }

    // Salvar no banco
    const { data: msgSalva, error: errMsg } = await supabase
      .from('mensagens_atendimento')
      .insert({
        atendimento_id,
        mensagem,
        tipo: 'atendente',
        atendente_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (errMsg) throw errMsg

    // Atualizar atendimento
    await supabase.from('atendimentos').update({
      ultima_mensagem: mensagem,
      updated_at: new Date().toISOString(),
      tem_mensagem_nova: false
    }).eq('id', atendimento_id)

    // Enviar via WhatsApp
    let whatsappResult: any = null
    if (enviar_whatsapp && atendimento.telefone) {
      try {
        const sent = await sendWhatsAppTextAtendimento(atendimento.telefone, mensagem)
        whatsappResult = { sent }

        // Log
        await supabase.from('whatsapp_logs').insert({
          atendimento_id,
          telefone: atendimento.telefone,
          mensagem,
          tipo: 'atendimento',
          status: sent ? 'enviado' : 'erro',
          provider_response: whatsappResult,
          created_at: new Date().toISOString()
        })

      } catch (e: any) {
        console.error('Erro envio WhatsApp atendimento:', e)
        whatsappResult = { error: e.message }
      }
    }

    return NextResponse.json({ success: true, mensagem: msgSalva, whatsapp: whatsappResult })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// LISTAR MENSAGENS DE UM ATENDIMENTO
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const atendimento_id = searchParams.get('atendimento_id')
    const empresaId = searchParams.get('empresa_id')

    // Listar atendimentos (sidebar)
    if (searchParams.get('list') === 'atendimentos') {
      const filtro = searchParams.get('filtro') || 'fila'
      const busca = searchParams.get('busca') || ''
      const atendenteId = searchParams.get('atendente_id')

      let query = supabase.from('atendimentos').select('*').order('updated_at', { ascending: false })

      if (empresaId) {
        query = query.eq('empresa_id', empresaId)
      }

      if (filtro === 'fila') {
        query = query.eq('status', 'aberto').is('atendente_id', null)
      } else if (filtro === 'meus' && atendenteId) {
        query = query.eq('atendente_id', atendenteId).neq('status', 'encerrado')
      } else if (filtro === 'encerrados') {
        query = query.eq('status', 'encerrado')
      } else if (filtro === 'todos') {
        query = query.neq('status', 'encerrado')
      }

      if (busca) {
        query = query.or(`nome_contato.ilike.%${busca}%,telefone.ilike.%${busca}%`)
      }

      const { data: list, error: listErr } = await query.limit(100)
      if (listErr) throw listErr
      return NextResponse.json(list)
    }

    if (!atendimento_id) {
      return NextResponse.json({ error: 'atendimento_id obrigatorio' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('mensagens_atendimento')
      .select('*')
      .eq('atendimento_id', atendimento_id)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ACOES: assumir, encerrar, reabrir, marcar_lido
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json()
    const { action, atendimento_id, atendente_id } = body

    if (!atendimento_id) {
      return NextResponse.json({ error: 'atendimento_id obrigatorio' }, { status: 400 })
    }

    const now = new Date().toISOString()
    let updateFields: Record<string, unknown> = { updated_at: now }

    switch (action) {
      case 'assumir':
        if (!atendente_id) return NextResponse.json({ error: 'atendente_id obrigatorio' }, { status: 400 })
        updateFields.atendente_id = atendente_id
        updateFields.status = 'em_atendimento'
        break
      case 'encerrar':
        updateFields.status = 'encerrado'
        updateFields.tem_mensagem_nova = false
        break
      case 'reabrir':
        updateFields.status = 'em_atendimento'
        break
      case 'marcar_lido':
        updateFields.tem_mensagem_nova = false
        break
      default:
        return NextResponse.json({ error: 'acao invalida' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('atendimentos')
      .update(updateFields)
      .eq('id', atendimento_id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, atendimento: data })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
