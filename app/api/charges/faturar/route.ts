export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/api';
import { criarPixImediato } from '@/lib/efi/pix';
import { criarBoleto } from '@/lib/efi/boleto';
import { createInterCharge } from '@/lib/inter/client';
import { createAsaasCharge } from '@/lib/asaas/client';
import { sendWhatsApp } from '@/lib/whatsapp';
import { formatCurrency, formatDate, monthNames } from '@/lib/format';
import type { Customer } from '@/lib/supabase';

/**
 * Unified "Faturar" endpoint.
 *
 * Generates BOTH Pix AND Boleto via EFI with certificado.p12,
 * saves all fields to DB, builds public invoice link,
 * and sends the full WhatsApp message automatically.
 */
export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdmin();
  try {
    const body = await request.json();
    const { subscriptionId, customerId, value: overrideValue, dueDate: overrideDueDate } = body;

    if (!subscriptionId && !customerId) {
      return NextResponse.json({ error: 'subscriptionId ou customerId é obrigatório' }, { status: 400 });
    }

    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const useInter = settings?.billing_provider === 'INTER';
    const useAsaas = settings?.billing_provider === 'ASAAS';
    const providerName = useInter ? 'INTER' : useAsaas ? 'ASAAS' : 'EFI';

    let customer: Customer | null = null;
    let value: number = 0;
    let dueDate: string = '';
    let planName: string = 'Cobrança';
    let subscriptionIdToSave: string | null = subscriptionId || null;

    if (subscriptionId) {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('*, customer:customers(*), plan:plans(*)')
        .eq('id', subscriptionId)
        .maybeSingle();

      if (!sub) {
        return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 });
      }

      customer = sub.customer as Customer;
      const plan = sub.plan;
      value = overrideValue ? Number(overrideValue) : Number(plan?.value || 0);
      planName = plan?.name || 'Cobrança';

      if (overrideDueDate) {
        dueDate = overrideDueDate;
      } else {
        const today = new Date();
        let dueDay = plan?.due_day || 10;
        if (plan?.tipo_vencimento === 'DATA_CONTRATO' && sub.start_date) {
          dueDay = new Date(sub.start_date).getDate();
        } else if (plan?.dia_vencimento) {
          dueDay = plan.dia_vencimento;
        }
        const maxDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        today.setDate(Math.min(dueDay, maxDay));
        dueDate = today.toISOString().split('T')[0];
      }
    } else {
      const { data: cust } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();

      if (!cust) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
      }

      customer = cust as Customer;
      value = Number(overrideValue || 0);
      dueDate = overrideDueDate || new Date().toISOString().split('T')[0];
      planName = body.description || 'Venda avulsa';
    }

    if (!customer || value <= 0) {
      return NextResponse.json({ error: 'Cliente ou valor inválido' }, { status: 400 });
    }

    // Validação de CPF/CNPJ para boleto
    const cpfLimpo = (customer.cpf_cnpj || '').replace(/\D/g, '');
    const semDocumento = !cpfLimpo || (cpfLimpo.length !== 11 && cpfLimpo.length !== 14);
    if (semDocumento) {
      console.warn('[Faturar] Cliente sem CPF/CNPJ válido:', customer.name, '— boleto não será gerado');
    }

    const externalRef = `CP${Date.now()}`;
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BOLT_PUBLIC_URL || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin);

    // === STEP A: Generate PIX (POST /v2/cob) ===
    let pixData: { txid: string; pixCopiaECola: string; qrCodeBase64: string; status: string } = {
      txid: '',
      pixCopiaECola: '',
      qrCodeBase64: '',
      status: 'PENDING',
    };

    try {
      if (useAsaas) throw new Error('PIX será gerado junto com o boleto no Asaas');
      const pix = await criarPixImediato({
        valor: value,
        nomePagador: customer.name,
        cpfCnpjPagador: customer.cpf_cnpj,
        mensagem: `${planName} - venc. ${dueDate}`,
      });
      pixData = {
        txid: pix.txid,
        pixCopiaECola: pix.pixCopiaECola || '',
        qrCodeBase64: pix.qrCodeBase64 || '',
        status: pix.status,
      };
      console.log('[Faturar] PIX gerado — txid:', pix.txid);
    } catch (pixErr) {
      const msg = pixErr instanceof Error ? pixErr.message : String(pixErr);
      console.warn('[Faturar] Erro ao gerar PIX:', msg);
    }

    // === STEP B: Generate BOLETO (POST /v1/charge or Inter) ===
    let boletoData: {
      chargeId: string;
      barcode: string;
      pdf: string;
      paymentUrl: string;
      status: string;
    } = { chargeId: '', barcode: '', pdf: '', paymentUrl: '', status: 'pending' };
    let boletoError = '';

    const webhookUrl = `${publicUrl}/api/webhooks/${useInter ? 'inter' : useAsaas ? 'asaas' : 'efi'}`;

    try {
      if (useAsaas) {
        const asaasCharge = await createAsaasCharge({ customerName: customer.name, customerCpfCnpj: customer.cpf_cnpj, customerEmail: customer.email || '', customerPhone: customer.whatsapp || '', value, dueDate, externalReference: externalRef });
        boletoData = { chargeId: asaasCharge.externalId, barcode: asaasCharge.barcode, pdf: asaasCharge.billetPdfUrl, paymentUrl: asaasCharge.paymentUrl, status: asaasCharge.status };
        if (asaasCharge.pixCopyPaste) {
          pixData.pixCopiaECola = asaasCharge.pixCopyPaste;
        }
        if (asaasCharge.pixQrCode) {
          pixData.qrCodeBase64 = asaasCharge.pixQrCode;
        }
        if (asaasCharge.externalId) {
          pixData.txid = asaasCharge.externalId;
        }
      } else if (useInter) {
        const interCharge = await createInterCharge({
          seuNumero: externalRef,
          valor: value,
          vencimento: dueDate,
          pagador: {
            cpfCnpj: customer.cpf_cnpj,
            nome: customer.name,
            email: customer.email || undefined,
          },
          mensagem: planName,
        });
        boletoData = {
          chargeId: interCharge.codigoSolicitacao,
          barcode: interCharge.linhaDigitavel || '',
          pdf: interCharge.pdfUrl || '',
          paymentUrl: interCharge.pdfUrl || '',
          status: interCharge.situacao || 'pending',
        };
        if (interCharge.pixCopiaECola) {
          pixData.pixCopiaECola = pixData.pixCopiaECola || interCharge.pixCopiaECola;
        }
        console.log('[Faturar] Boleto Inter gerado — codigoSolicitacao:', interCharge.codigoSolicitacao);
      } else {
        const boleto = await criarBoleto({
          customerName: customer.name,
          customerCpfCnpj: customer.cpf_cnpj,
          customerEmail: customer.email || '',
          customerPhone: customer.whatsapp || '',
          valor: value,
          vencimento: dueDate,
          mensagem: planName,
          externalReference: externalRef,
          notificationUrl: webhookUrl,
        });
        boletoData = {
          chargeId: boleto.chargeId,
          barcode: boleto.barcode || '',
          pdf: boleto.pdf || '',
          paymentUrl: boleto.paymentUrl || '',
          status: boleto.status || 'pending',
        };
        console.log('[Faturar] Boleto Efí gerado — chargeId:', boleto.chargeId);
      }
    } catch (boletoErr) {
      boletoError = boletoErr instanceof Error ? boletoErr.message : String(boletoErr);
      console.warn('[Faturar] Erro ao gerar boleto:', boletoError);
    }

    if (!boletoData.chargeId) {
      console.warn('[Faturar] BOLETO NÃO GERADO —', boletoError || 'Efí não retornou chargeId');
      // Continua sem boleto: salva a cobrança com PIX apenas, mostra aviso no frontend
    }

    // Build public invoice link
    const invoiceId = pixData.txid || boletoData.chargeId || externalRef;
    const linkFaturaPublica = `${publicUrl}/fatura/${invoiceId}`;

    // === Save charge in DB with ALL fields ===
    const { data: charge, error } = await supabaseAdmin
      .from('charges')
      .insert({
        customer_id: customer.id,
        subscription_id: subscriptionIdToSave,
        value,
        due_date: dueDate,
        status: 'PENDING',
        provider: providerName,
        external_id: invoiceId,
        txid: pixData.txid || null,
        pix_copy_paste: pixData.pixCopiaECola || null,
        pix_qr_code: pixData.qrCodeBase64 || null,
        barcode: boletoData.barcode || null,
        barcode_boleto: boletoData.barcode || null,
        boleto_linha: boletoData.barcode || null,
        boleto_charge_id: boletoData.chargeId || null,
        boleto_url: boletoData.pdf || null,
        boleto_status: boletoData.status || null,
        billet_pdf_url: boletoData.pdf || null,
        payment_url: boletoData.paymentUrl || null,
        link_fatura_publica: linkFaturaPublica,
        charge_type: subscriptionId ? 'RECURRING' : 'SALE',
        description: planName,
        erro_boleto: boletoError || null,
      })
      .select('*, customer:customers(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao salvar cobrança: ' + error.message }, { status: 500 });
    }

    // === STEP C: Send WhatsApp message with full template ===
    if (customer.whatsapp) {
      try {
        const fullMonthNames = [
          'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
          'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
        ];
        const dueDateObj = new Date(dueDate);
        const mesReferencia = `${fullMonthNames[dueDateObj.getMonth()]}/${dueDateObj.getFullYear()}`;
        const nomeEmpresa = settings?.issuer_trade_name || settings?.issuer_name || 'Nossa Empresa';

        const template = settings?.template_faturar ||
          `Ola, {NOME_CLIENTE},\n\nSua Fatura já se encontra Disponível\n{NOME_EMPRESA}\n\nSua Mensalidade referente ao mês de: {MES_REFERENCIA} vence no dia: {DATA_VENCIMENTO}\nNo Valor: R$ {VALOR}\n\nCaso Deseje Realizar o Pagamento segue os dados abaixo:\n\nClique no Link da fatura abaixo para Efetuar o Pagamento:\n(PIX E BOLETO)\nClique no Link abaixo:\n{link_fatura_publica}\n\nPara acessar seu Boleto Clique Aqui:\n{boleto_url}\n\nLinha digitavel do boleto:\n{linha_digitavel}\n\nPIX Copia e Cola:\n{pix_copia_e_cola}\n\nQualquer dúvida, problema ou sugestão por favor entre em contato conosco para que possamos lhe ajudar.`;

        const renderedMessage = template
          .replace(/{NOME_CLIENTE}/g, customer.name.split(' ')[0])
          .replace(/{nome}/g, customer.name.split(' ')[0])
          .replace(/{NOME_EMPRESA}/g, nomeEmpresa)
          .replace(/{MES_REFERENCIA}/g, mesReferencia)
          .replace(/{mes}/g, monthNames[dueDateObj.getMonth()])
          .replace(/{DATA_VENCIMENTO}/g, formatDate(dueDate))
          .replace(/{data_vencimento}/g, formatDate(dueDate))
          .replace(/{VALOR}/g, value.toFixed(2).replace('.', ','))
          .replace(/{valor}/g, formatCurrency(value))
          .replace(/{link_fatura_publica}/g, linkFaturaPublica)
          .replace(/{boleto_url}/g, boletoData.pdf || boletoData.paymentUrl || '')
          .replace(/{boleto}/g, boletoData.barcode || '')
          .replace(/{linha_digitavel}/g, boletoData.barcode || '')
          .replace(/{pix_copia_e_cola}/g, pixData.pixCopiaECola || '')
          .replace(/{pix}/g, pixData.pixCopiaECola || '')
          .replace(/{plano}/g, planName)
          .replace(/{link}/g, linkFaturaPublica);
        const message = renderedMessage.includes(linkFaturaPublica)
          ? renderedMessage
          : `${renderedMessage}\n\nAcesse o painel de pagamento:\n${linkFaturaPublica}`;

        await sendWhatsApp(customer.whatsapp, message, boletoData.pdf || undefined);
        console.log('[Faturar] WhatsApp enviado para:', customer.whatsapp);
      } catch (waErr) {
        console.error('[Faturar] WhatsApp send error:', waErr);
      }
    }

    console.log('[Faturar] Cobrança criada com sucesso — PIX txid:', pixData.txid, '| Boleto chargeId:', boletoData.chargeId);
    console.log('[Faturar] Link fatura publica:', linkFaturaPublica);

    console.log('CORREÇÃO BOLETO APLICADA — PIX:', pixData.txid ? 'OK' : 'FALHOU', '| Boleto:', boletoData.chargeId ? 'OK' : 'FALHOU' + (semDocumento ? ' (sem CPF)' : ''));
    return NextResponse.json({
      success: true,
      charge,
      linkFaturaPublica,
      warnings: [
        ...(semDocumento ? [`Cliente sem CPF/CNPJ — boleto não gerado. Cadastre o documento do cliente.`] : []),
        ...(!boletoData.chargeId && !semDocumento ? [`Boleto não gerado pelo ${providerName}: ${boletoError}`] : []),
      ].filter(Boolean),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Faturar] Erro:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
