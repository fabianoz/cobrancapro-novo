import { NextResponse } from 'next/server';
import { loadInterConfig, getInterToken } from '@/lib/inter/client';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    let cfg = await loadInterConfig();

    if (body.clientId) cfg = { ...cfg, clientId: body.clientId };
    if (body.clientSecret) cfg = { ...cfg, clientSecret: body.clientSecret };
    if (body.certBase64) cfg = { ...cfg, certBase64: body.certBase64 };
    if (body.keyBase64) cfg = { ...cfg, keyBase64: body.keyBase64 };
    if (body.sandbox !== undefined) cfg = { ...cfg, sandbox: body.sandbox };

    if (!cfg.clientId || !cfg.clientSecret) {
      return NextResponse.json(
        { success: false, message: 'Client ID e Client Secret do Inter não configurados' },
        { status: 400 }
      );
    }

    if (!cfg.certBase64 || !cfg.keyBase64) {
      return NextResponse.json(
        { success: false, message: 'Certificado .crt e chave .key do Inter não carregados' },
        { status: 400 }
      );
    }

    try {
      const token = await getInterToken();
      return NextResponse.json({
        success: true,
        message: `Conexão Banco Inter OK — token obtido (${token.substring(0, 20)}...)`,
      });
    } catch (tokenErr) {
      const msg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
      return NextResponse.json({ success: false, message: msg }, { status: 500 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
