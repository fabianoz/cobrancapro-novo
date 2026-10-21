/**
 * Recurrence Engine
 *
 * Finds all ACTIVE subscriptions where nextBillingDate = today,
 * creates a Charge via the selected provider, saves in DB,
 * and sends notification.
 *
 * Supports two vencimento types:
 * - DIA_FIXO: uses plan.dia_vencimento as the due day
 * - DATA_CONTRATO: uses subscription.start_date day as the due day
 */

import { supabaseAdmin } from './supabase';
import { getProvider } from './providers';
import { sendNotification } from './notifications';
import { formatCurrency } from './format';
import type { Subscription, Customer, Plan, Charge, SubscriptionAddon } from './supabase';

function getNextBillingDate(
  cycle: string,
  current: Date,
  dueDay: number,
  tipoVencimento: string,
  dataInicio: string
): Date {
  const next = new Date(current);
  switch (cycle) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'MONTHLY':
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  // Adjust due day if monthly/yearly
  if (cycle === 'MONTHLY' || cycle === 'YEARLY') {
    let effectiveDueDay = dueDay;
    if (tipoVencimento === 'DATA_CONTRATO' && dataInicio) {
      const startDate = new Date(dataInicio);
      effectiveDueDay = startDate.getDate();
    }
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(effectiveDueDay, maxDay));
  }
  return next;
}

function getDueDayForPlan(plan: Plan, sub: Subscription): number {
  if (plan.tipo_vencimento === 'DATA_CONTRATO' && sub.start_date) {
    const startDate = new Date(sub.start_date);
    return startDate.getDate();
  }
  return plan.dia_vencimento || plan.due_day;
}

export async function generateCharges(): Promise<{ created: number; errors: number }> {
  // Usa fuso de Brasília (UTC-3) para evitar desalinhamento após 21h UTC
  const now = new Date();
  const brOffset = -3 * 60;
  const localMs = now.getTime() + (brOffset - now.getTimezoneOffset()) * 60000;
  const today = new Date(localMs);
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Get settings for provider selection
  const { data: globalSettings } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  const providerName = globalSettings?.billing_provider || 'EFI';
  const provider = getProvider(providerName);

  // Find active subscriptions due today
  const { data: subscriptions } = await supabaseAdmin
    .from('subscriptions')
    .select('*, customer:customers(*), plan:plans(*), addons:subscription_addons(*)')
    .eq('status', 'ACTIVE')
    .eq('next_billing_date', todayStr);

  if (!subscriptions || subscriptions.length === 0) {
    return { created: 0, errors: 0 };
  }

  let created = 0;
  let errors = 0;

  for (const sub of subscriptions) {
    const customer = sub.customer as Customer;
    const plan = sub.plan as Plan;
    const addons = (sub.addons as SubscriptionAddon[] || []).filter(
      (a) => a.status === 'ACTIVE' && a.remaining_months > 0
    );

    if (!customer || !plan) {
      errors++;
      continue;
    }

    const baseValue = Number(plan.value);
    const addonTotal = addons.reduce((sum, a) => sum + Number(a.value), 0);
    const totalValue = baseValue + addonTotal;
    const addonDescription = addons.length > 0
      ? `${plan.name} + ${addons.map((a) => `${a.name} (${formatCurrency(a.value)})`).join(', ')}`
      : null;

    // Calculate due date based on tipo_vencimento
    const dueDay = getDueDayForPlan(plan, sub as Subscription);
    const dueDate = new Date(today);
    const maxDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
    dueDate.setDate(Math.min(dueDay, maxDay));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    try {
      const externalReference = `CP${sub.id.slice(0, 8)}`.replace(/-/g, '');
      const empresaIdForCharge = sub.empresa_id || (sub.customer as any)?.empresa_id || null;
      let settingsForCharge = globalSettings;
      if (empresaIdForCharge) {
        const { data: es } = await supabaseAdmin
          .from('empresa_settings')
          .select('*')
          .eq('empresa_id', empresaIdForCharge)
          .maybeSingle();
        if (es) settingsForCharge = es;
      }
      const chargeProviderName = settingsForCharge?.billing_provider || providerName;
      const chargeProvider = chargeProviderName !== providerName ? getProvider(chargeProviderName) : provider;

      const providerCharge = await chargeProvider.createCharge({
        customerName: customer.name,
        customerCpfCnpj: customer.cpf_cnpj,
        customerEmail: customer.email || '',
        customerPhone: customer.whatsapp || '',
        value: totalValue,
        dueDate: dueDateStr,
        externalReference,
      });

      const pixTxid = '';
      const pixCopyPaste = providerCharge.pixCopyPaste || '';
      const pixQrCode = providerCharge.pixQrCode || '';
      const boletoChargeId = providerCharge.externalId || '';
      const boletoBarcode = providerCharge.barcode || '';
      const boletoPdf = providerCharge.billetPdfUrl || '';
      const boletoPaymentUrl = providerCharge.paymentUrl || '';
      const invoiceId = boletoChargeId || `local-${Date.now()}`;
      const publicUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const linkFatura = `${publicUrl}/fatura/${invoiceId}`;

      // Save charge in DB with ALL fields
      const { data: charge, error } = await supabaseAdmin
        .from('charges')
        .insert({
          customer_id: customer.id,
          subscription_id: sub.id,
          value: totalValue,
          due_date: dueDateStr,
          status: 'PENDING',
          provider: chargeProviderName,
          external_id: invoiceId,
          empresa_id: empresaIdForCharge,
          txid: pixTxid || null,
          pix_copy_paste: pixCopyPaste || null,
          pix_qr_code: pixQrCode || null,
          barcode: boletoBarcode || null,
          barcode_boleto: boletoBarcode || null,
          boleto_linha: boletoBarcode || null,
          boleto_charge_id: boletoChargeId || null,
          boleto_url: boletoPdf || null,
          boleto_status: boletoChargeId ? 'pending' : null,
          billet_pdf_url: boletoPdf || null,
          payment_url: boletoPaymentUrl || null,
          link_fatura_publica: linkFatura,
          charge_type: addons.length > 0 ? 'ADDON' : 'RECURRING',
          description: addonDescription || plan.name,
        })
        .select('*, customer:customers(*)')
        .single();

      if (error) {
        console.error('[Recurrence] DB insert error:', error);
        errors++;
        continue;
      }

      // Update subscription next billing date
      const nextDate = getNextBillingDate(
        plan.cycle,
        today,
        plan.due_day,
        plan.tipo_vencimento || 'DIA_FIXO',
        sub.start_date
      );
      await supabaseAdmin
        .from('subscriptions')
        .update({ next_billing_date: nextDate.toISOString().split('T')[0] })
        .eq('id', sub.id);

      // Decrement remaining_months on each addon, expire if 0
      for (const addon of addons) {
        const newRemaining = addon.remaining_months - 1;
        await supabaseAdmin
          .from('subscription_addons')
          .update({
            remaining_months: newRemaining,
            status: newRemaining <= 0 ? 'EXPIRED' : 'ACTIVE',
          })
          .eq('id', addon.id);
      }

      // Send notification (non-blocking) — includes auto WhatsApp
      if (charge) {
        sendNotification(charge as Charge, customer).catch((err) =>
          console.error('[Recurrence] Notification error:', err)
        );
      }

      created++;
    } catch (err) {
      console.error('[Recurrence] Error processing subscription:', err);
      errors++;
    }
  }

  // Process reminders for existing pending charges
  try {
    const { processReminders, flushNotificationQueue } = await import('./notifications');
    await processReminders();
    await flushNotificationQueue();
  } catch (err) {
    console.error('[Recurrence] Reminder processing error:', err);
  }

  return { created, errors };
}
