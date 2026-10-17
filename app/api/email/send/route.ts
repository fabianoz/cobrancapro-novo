export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { sendEmail, buildEmailHtml } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/supabase/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Customer, Charge } from '@/lib/supabase';

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const { to, subject, chargeId, message } = await request.json();

    if (!to) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    let html = '';
    let finalSubject = subject || 'CobrancaPro';

    if (chargeId) {
      const { data: charge } = await supabaseAdmin
        .from('charges')
        .select('*, customer:customers(*)')
        .eq('id', chargeId)
        .maybeSingle();

      if (charge && charge.customer) {
        const customer = charge.customer as Customer;
        finalSubject = subject || `Cobranca CobrancaPro — ${formatCurrency(Number(charge.value))}`;

        if (message) {
          // Custom message: wrap in a simple HTML template
          html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #0f172a; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 22px;">CobrancaPro</h1>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
                <p style="font-size: 15px; color: #1e293b; white-space: pre-wrap; line-height: 1.6;">${message.replace(/</g, '&lt;')}</p>
                ${charge.payment_url ? `
                  <a href="${charge.payment_url}" style="display: inline-block; margin-top: 20px; background: #0f172a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-size: 15px;">
                    Pagar Agora
                  </a>
                ` : ''}
                <p style="margin-top: 24px; font-size: 13px; color: #94a3b8;">
                  CobrancaPro — Sistema de Cobranca Recorrente
                </p>
              </div>
            </div>
          `;
        } else {
          html = buildEmailHtml(customer, charge as Charge);
        }
      }
    } else if (message) {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #0f172a; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">CobrancaPro</h1>
          </div>
          <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
            <p style="font-size: 15px; color: #1e293b; white-space: pre-wrap; line-height: 1.6;">${message.replace(/</g, '&lt;')}</p>
          </div>
        </div>
      `;
    } else {
      html = `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>${finalSubject}</h2></div>`;
    }

    const sent = await sendEmail(to, finalSubject, html);

    if (!sent) {
      return NextResponse.json(
        { error: 'Falha ao enviar email. Configure o SMTP em Configuracoes ou verifique o console do servidor para o erro detalhado.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
