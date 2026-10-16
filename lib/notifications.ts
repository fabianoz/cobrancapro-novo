import { supabaseAdmin } from './supabase';
import { sendWhatsApp } from './whatsapp';
import { formatCurrency, formatDate, monthNames } from './format';
import { isBusinessHours, getOutsideBusinessHoursReason, type BusinessHoursConfig, DEFAULT_BUSINESS_HOURS } from './business-hours';
import type { Charge, Customer, Settings } from './supabase';
import nodemailer from 'nodemailer';

/**
 * Notification system for CobrancaPro
 *
 * - sendEmail: via SMTP (nodemailer) with config from DB, or Resend API as fallback
 * - sendWhatsApp: via Evolution API (lib/whatsapp.ts)
 *
 * Messages are ONLY sent during business hours (Mon-Fri, 09-18h, no holidays).
 * Outside business hours, messages are queued in the notification_queue table
 * and flushed by the queue processor during the next business hours window.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'cobranca@cobrancapro.com.br';

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  fromEmail: string;
};

async function loadSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure, smtp_from_email')
      .eq('id', 1)
      .maybeSingle();

    if (data?.smtp_host && data?.smtp_user) {
      return {
        host: data.smtp_host,
        port: data.smtp_port || 587,
        user: data.smtp_user,
        pass: data.smtp_password || '',
        secure: data.smtp_secure ?? false,
        fromEmail: data.smtp_from_email || data.smtp_user,
      };
    }
  } catch {
    // DB not available
  }
  return null;
}

/**
 * Send an email via SMTP (nodemailer) or Resend API as fallback.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const smtpConfig = await loadSmtpConfig();

  if (smtpConfig) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
      });

      const info = await transporter.sendMail({
        from: smtpConfig.fromEmail,
        to,
        subject,
        html,
      });

      console.log('[Notifications] Email sent via SMTP:', info.messageId);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Notifications] SMTP send error:', msg);
      return false;
    }
  }

  if (!RESEND_API_KEY) {
    console.warn('[Notifications] No email configured — set SMTP in Settings or RESEND_API_KEY env var');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Notifications] Resend sendEmail failed: ${response.status} ${errText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Notifications] Resend sendEmail error:', err);
    return false;
  }
}

/**
 * Build the notification message from a template
 * Supports both new-style {nome}, {valor}, {data_vencimento}, {pix}, {boleto}, {link}, {plano}, {mes}
 * and legacy-style {{name}}, {{value}}, etc.
 */
export function buildMessage(
  template: string,
  customer: Customer,
  charge: Charge,
  settings?: Pick<Settings, 'issuer_name' | 'issuer_trade_name'>
): string {
  const monthLabel = monthNames[new Date(charge.due_date).getMonth()];
  const planName = charge.description || (charge as any).subscription?.plan?.name || 'plano';
  const publicLink = charge.link_fatura_publica || charge.payment_url || '';
  const boletoLine = charge.boleto_linha || charge.barcode_boleto || charge.barcode || '';
  const boletoUrl = charge.boleto_url || charge.billet_pdf_url || charge.payment_url || '';
  const value = formatCurrency(Number(charge.value));
  const dueDate = formatDate(charge.due_date);
  const legalName = settings?.issuer_name || settings?.issuer_trade_name || 'Nossa empresa';
  return template
    .replace(/\{nome\}/g, customer.name.split(' ')[0])
    .replace(/\{NOME_CLIENTE\}/g, customer.name.split(' ')[0])
    .replace(/\{RAZAO_SOCIAL\}/g, legalName)
    .replace(/\{NOME_EMPRESA\}/g, legalName)
    .replace(/\{EMPRESA\}/g, legalName)
    .replace(/\{valor\}/g, value)
    .replace(/\{VALOR\}/g, Number(charge.value).toFixed(2).replace('.', ','))
    .replace(/\{data_vencimento\}/g, dueDate)
    .replace(/\{DATA_VENCIMENTO\}/g, dueDate)
    .replace(/\{pix\}/g, charge.pix_copy_paste || '')
    .replace(/\{pix_copia_e_cola\}/g, charge.pix_copy_paste || '')
    .replace(/\{PIX_COPIA_E_COLA\}/g, charge.pix_copy_paste || '')
    .replace(/\{boleto\}/g, boletoLine)
    .replace(/\{linha_digitavel\}/g, boletoLine)
    .replace(/\{LINHA_DIGITAVEL\}/g, boletoLine)
    .replace(/\{boleto_url\}/g, boletoUrl)
    .replace(/\{BOLETO_URL\}/g, boletoUrl)
    .replace(/\{link\}/g, publicLink)
    .replace(/\{link_fatura_publica\}/g, publicLink)
    .replace(/\{LINK_FATURA_PUBLICA\}/g, publicLink)
    .replace(/\{plano\}/g, planName)
    .replace(/\{mes\}/g, monthLabel || '')
    .replace(/\{MES_REFERENCIA\}/g, monthLabel || '')
    // Legacy support
    .replace(/\{\{name\}\}/g, customer.name.split(' ')[0])
    .replace(/\{\{value\}\}/g, formatCurrency(Number(charge.value)))
    .replace(/\{\{dueDate\}\}/g, formatDate(charge.due_date))
    .replace(/\{\{paymentUrl\}\}/g, charge.payment_url || '')
    .replace(/\{\{pixCopyPaste\}\}/g, charge.pix_copy_paste || '');
}

/**
 * Build HTML email body for a charge notification
 */
export function buildEmailHtml(customer: Customer, charge: Charge): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #0f172a; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 22px;">CobrancaPro</h1>
        <p style="margin: 4px 0 0; opacity: 0.7; font-size: 14px;">Lembrete de Pagamento</p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; color: #1e293b;">Olá <strong>${customer.name.split(' ')[0]}</strong>,</p>
        <p style="font-size: 15px; color: #475569;">
          Sua cobrança de <strong style="color: #0f172a; font-size: 18px;">${formatCurrency(charge.value)}</strong>
          vence em <strong>${formatDate(charge.due_date)}</strong>.
        </p>
        ${charge.pix_copy_paste ? `
          <p style="font-size: 14px; color: #475569; margin-top: 20px;">PIX Copia e Cola:</p>
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 12px; word-break: break-all; color: #334155;">
            ${charge.pix_copy_paste}
          </div>
        ` : ''}
        ${charge.payment_url ? `
          <a href="${charge.payment_url}" style="display: inline-block; margin-top: 20px; background: #0f172a; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-size: 15px;">
            Pagar Agora
          </a>
        ` : ''}
        <p style="margin-top: 24px; font-size: 13px; color: #94a3b8;">
          CobrancaPro — Sistema de Cobrança Recorrente
        </p>
      </div>
    </div>
  `;
}

async function getSettings(): Promise<Settings | null> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return data as Settings | null;
}

/**
 * Queue a notification for later delivery (when outside business hours).
 */
async function queueNotification(
  charge: Charge,
  customer: Customer,
  channel: 'whatsapp' | 'email',
  message: string,
  subject: string | null,
  fileUrl: string | null,
  reminderLabel: string
): Promise<void> {
  await supabaseAdmin.from('notification_queue').insert({
    charge_id: charge.id,
    customer_id: customer.id,
    channel,
    message,
    subject,
    file_url: fileUrl,
    reminder_label: reminderLabel,
    status: 'PENDING',
  });
  console.log(`[Notifications] Queued ${channel} for ${customer.name} (outside business hours)`);
}

/**
 * Send charge notification via both email and WhatsApp.
 *
 * During business hours (Mon-Fri 09-18h, no holidays): sends immediately.
 * Outside business hours: queues in notification_queue for later delivery.
 */
export async function sendNotification(
  charge: Charge,
  customer: Customer,
  options?: { isReminder?: boolean; reminderLabel?: string }
): Promise<void> {
  const settings = await getSettings();
  const template = settings?.template_faturar ||
    settings?.email_template ||
    `Olá {nome}, sua cobrança do mês de {mes} referente ao plano {plano} no valor de {valor} já está disponível para pagamento. Vencimento {data_vencimento}. Segue o Pix: {pix} ou Boleto: {boleto}`;

  const reminderPrefix = options?.isReminder && options.reminderLabel
    ? `*${options.reminderLabel}* `
    : '';

  const publicLink = charge.link_fatura_publica || '';
  const renderedMessage = buildMessage(template, customer, charge, settings ?? undefined);
  const messageBody = publicLink && !renderedMessage.includes(publicLink)
    ? `${renderedMessage}\n\nAcesse o painel de pagamento:\n${publicLink}`
    : renderedMessage;
  const message = reminderPrefix + messageBody;
  const label = options?.reminderLabel || 'CREATED';

  const withinHours = isBusinessHours(DEFAULT_BUSINESS_HOURS);

  if (!withinHours) {
    const reason = getOutsideBusinessHoursReason(DEFAULT_BUSINESS_HOURS);
    console.log(`[Notifications] Outside business hours. ${reason}`);

    // Queue both channels
    if (customer.whatsapp) {
      await queueNotification(charge, customer, 'whatsapp', message, null, charge.billet_pdf_url || null, label);
    }
    if (customer.email) {
      const subject = options?.isReminder
        ? `Lembrete: Cobrança vence em ${formatDate(charge.due_date)}`
        : `Cobrança CobrancaPro — ${formatCurrency(charge.value)}`;
      const html = buildEmailHtml(customer, charge);
      await queueNotification(charge, customer, 'email', html, subject, null, label);
    }
  } else {
    // Send WhatsApp immediately (non-blocking)
    if (customer.whatsapp) {
      sendWhatsApp(customer.whatsapp, message, charge.billet_pdf_url || undefined).catch(
        (err) => console.error('[Notifications] WhatsApp error:', err)
      );
    }

    // Send Email immediately (non-blocking)
    if (customer.email) {
      const subject = options?.isReminder
        ? `Lembrete: Cobrança vence em ${formatDate(charge.due_date)}`
        : `Cobrança CobrancaPro — ${formatCurrency(charge.value)}`;
      const html = buildEmailHtml(customer, charge);
      sendEmail(customer.email, subject, html).catch((err) =>
        console.error('[Notifications] Email error:', err)
      );
    }
  }

  // Track which notifications were sent/queued
  const sentSoFar = charge.notifications_sent
    ? charge.notifications_sent.split(',').filter(Boolean)
    : [];
  if (!sentSoFar.includes(label)) {
    sentSoFar.push(label);
    await supabaseAdmin
      .from('charges')
      .update({ notifications_sent: sentSoFar.join(',') })
      .eq('id', charge.id);
  }
}

/**
 * Check for pending charges that need reminder notifications.
 * Reminder rules from settings: D-3, D-0, D+1, D+3, D+7
 *
 * D-N means N days before due date
 * D+N means N days after due date
 */
export async function processReminders(): Promise<{ processed: number }> {
  const settings = await getSettings();
  const rules = (settings?.reminder_rules || 'D-1,D-0,D+1,D+5')
    .split(',')
    .map((r) => r.trim().toUpperCase());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let processed = 0;

  for (const rule of rules) {
    const match = rule.match(/^D([+-])(\d+)$/);
    if (!match) continue;

    const sign = match[1];
    const days = parseInt(match[2], 10);
    const offsetDays = sign === '-' ? -days : days;

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() - offsetDays);
    const dateStr = targetDate.toISOString().split('T')[0];

    const { data: charges } = await supabaseAdmin
      .from('charges')
      .select('*, customer:customers(*)')
      .eq('status', 'PENDING')
      .eq('due_date', dateStr);

    if (!charges) continue;

    for (const charge of charges) {
      const sentSoFar = charge.notifications_sent
        ? charge.notifications_sent.split(',').filter(Boolean)
        : [];

      if (sentSoFar.includes(rule)) continue;

      const customer = charge.customer as Customer;
      if (!customer) continue;

      if (offsetDays > 0) {
        await supabaseAdmin
          .from('charges')
          .update({ status: 'OVERDUE' })
          .eq('id', charge.id);
      }

      // Pick the right template for this reminder rule
      const templateMap: Record<string, string> = {
        'D-1': settings?.template_lembrete_d3 || '',
        'D-0': settings?.template_lembrete_d0 || '',
        'D+1': settings?.template_lembrete_d1 || '',
        'D+5': settings?.template_lembrete_d7_pos || '',
      };
      const customTemplate = templateMap[rule];
      if (customTemplate) {
        const message = buildMessage(customTemplate, customer, charge as Charge, settings ?? undefined);
        if (customer.whatsapp) {
          sendWhatsApp(customer.whatsapp, message, (charge as Charge).billet_pdf_url || undefined).catch(() => {});
        }
        if (customer.email) {
          const subject = `Lembrete: Cobrança vence em ${formatDate((charge as Charge).due_date)}`;
          const html = buildEmailHtml(customer, charge as Charge);
          sendEmail(customer.email, subject, html).catch(() => {});
        }
      } else {
        await sendNotification(charge as Charge, customer, {
          isReminder: true,
          reminderLabel: rule,
        });
      }
      processed++;
    }
  }

  return { processed };
}

/**
 * Process the notification queue: send all PENDING messages.
 * Only runs during business hours. Called by the cron job or
 * by generateCharges after creating new charges.
 *
 * Returns the number of messages sent.
 */
export async function flushNotificationQueue(): Promise<{ sent: number }> {
  if (!isBusinessHours(DEFAULT_BUSINESS_HOURS)) {
    console.log('[Notifications] Queue flush skipped — outside business hours');
    return { sent: 0 };
  }

  const { data: queued } = await supabaseAdmin
    .from('notification_queue')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(100);

  if (!queued || queued.length === 0) {
    return { sent: 0 };
  }

  let sent = 0;

  for (const item of queued) {
    let success = false;

    if (item.channel === 'whatsapp') {
      // Fetch customer to get phone number
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('whatsapp')
        .eq('id', item.customer_id)
        .maybeSingle();

      if (customer?.whatsapp) {
        success = await sendWhatsApp(customer.whatsapp, item.message, item.file_url || undefined);
      }
    } else if (item.channel === 'email') {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('email')
        .eq('id', item.customer_id)
        .maybeSingle();

      if (customer?.email) {
        success = await sendEmail(customer.email, item.subject || 'CobrancaPro', item.message);
      }
    }

    if (success) {
      await supabaseAdmin
        .from('notification_queue')
        .update({ status: 'SENT', sent_at: new Date().toISOString() })
        .eq('id', item.id);
      sent++;
    }
  }

  if (sent > 0) {
    console.log(`[Notifications] Queue flush: ${sent} messages sent`);
  }

  return { sent };
}
