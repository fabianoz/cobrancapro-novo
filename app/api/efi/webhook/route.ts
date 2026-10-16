import { NextResponse } from 'next/server';
import { cadastrarWebhookPix } from '@/lib/efi/pix';
import { loadEfiConfig } from '@/lib/efi/auth';

/** Cadastra o webhook na API Efí para receber notificações de Pix */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const webhookUrl = body.webhookUrl || `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhooks/efi/pix`;

    const cfg = await loadEfiConfig();
    if (!cfg.pixKey) {
      return NextResponse.json({ error: 'PIX key não configurada' }, { status: 400 });
    }

    await cadastrarWebhookPix(cfg.pixKey, webhookUrl);

    return NextResponse.json({
      success: true,
      message: 'Webhook cadastrado',
      webhookUrl,
      pixKey: cfg.pixKey,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
