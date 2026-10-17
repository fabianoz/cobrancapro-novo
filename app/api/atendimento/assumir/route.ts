export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { atendimento_id, atendente_email, atendente_nome } = await request.json()

    if (!atendimento_id) {
      return NextResponse.json({ success: false, message: 'atendimento_id obrigatório' }, { status: 400 })
    }

    // Tenta assumir - só assume se estiver em waiting
    const { data, error } = await supabaseAdmin
      .from('atendimentos')
      .update({
        status: 'in_progress',
        assigned_to: atendente_email,
        assigned_to_nome: atendente_nome,
        updated_at: new Date().toISOString()
      })
      .eq('id', atendimento_id)
      .eq('status', 'waiting')
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, message: 'Conversa já foi assumida por outro atendente' }, { status: 409 })
    }

    return NextResponse.json({ success: true, atendimento: data })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 })
  }
}
