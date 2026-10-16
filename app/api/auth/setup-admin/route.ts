import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios.' }, { status: 400 });
    }

    // Step 1: Create auth user via signUp (GoTrue creates it properly)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    // If user already exists, that's OK — we just need to set up the profile
    if (signUpError && !signUpError.message.toLowerCase().includes('already') && !signUpError.message.toLowerCase().includes('registered')) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    // Step 2: Create the system profile + permissions via database function
    const { data, error: rpcError } = await supabase.rpc('bootstrap_admin', {
      p_email: email,
      p_password: password,
    });

    if (rpcError) {
      if (rpcError.message.includes('já existe')) {
        return NextResponse.json({ error: 'Administrador já existe.' }, { status: 409 });
      }
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 },
    );
  }
}
