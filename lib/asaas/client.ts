import type { ChargeRequestData, ChargeResponse } from '@/lib/providers/types';
import { supabaseAdmin } from '@/lib/supabase';

async function getConfig() {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('asaas_api_key, asaas_sandbox')
    .eq('id', 1)
    .maybeSingle();

  const apiKey = data?.asaas_api_key || process.env.ASAAS_API_KEY || '';
  const sandbox = data?.asaas_sandbox ?? process.env.ASAAS_ENV !== 'production';

  if (!apiKey) throw new Error('Asaas não configurado. Defina a API Key nas configurações.');
  return { apiKey, baseUrl: sandbox ? 'https://api-sandbox.asaas.com' : 'https://api.asaas.com' };
}

function headers(apiKey: string) {
  return { 'Content-Type': 'application/json', access_token: apiKey };
}

export async function testAsaasConnection(): Promise<{ environment: string; accountEmail: string }> {
  const { apiKey, baseUrl } = await getConfig();
  const response = await fetch(`${baseUrl}/v3/myAccount`, {
    headers: headers(apiKey),
  });
  const responseText = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    throw new Error(`Resposta inválida da API Asaas (HTTP ${response.status})`);
  }
  if (!response.ok) {
    const errors = Array.isArray(data.errors) ? data.errors as Array<{ description?: string }> : [];
    const msg = errors[0]?.description || 'Falha na conexão com Asaas';
    throw new Error(msg);
  }
  return {
    environment: baseUrl.includes('sandbox') ? 'Homologação' : 'Produção',
    accountEmail: typeof data.email === 'string' ? data.email : 'N/A',
  };
}

export async function createAsaasCharge(data: ChargeRequestData): Promise<ChargeResponse> {
  const { apiKey, baseUrl } = await getConfig();

  const cpfCnpj = (data.customerCpfCnpj || '').replace(/\D/g, '');

  let customerId = '';

  const searchRes = await fetch(
    `${baseUrl}/v3/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`,
    { headers: headers(apiKey) },
  );
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id;
    }
  }

  if (!customerId) {
    const createRes = await fetch(`${baseUrl}/v3/customers`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        name: data.customerName,
        cpfCnpj,
        email: data.customerEmail || undefined,
        mobilePhone: data.customerPhone || undefined,
        externalReference: data.externalReference,
      }),
    });
    const customer = await createRes.json();
    if (!createRes.ok) {
      const msg = customer.errors?.[0]?.description || 'Não foi possível cadastrar o cliente no Asaas';
      throw new Error(msg);
    }
    customerId = customer.id;
  }

  const paymentRes = await fetch(`${baseUrl}/v3/payments`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({
      customer: customerId,
      billingType: 'BOLETO',
      value: data.value,
      dueDate: data.dueDate,
      description: `Cobrança ${data.externalReference}`,
      externalReference: data.externalReference,
      postalService: false,
    }),
  });
  const payment = await paymentRes.json();
  if (!paymentRes.ok) {
    const msg = payment.errors?.[0]?.description || 'Não foi possível criar a cobrança no Asaas';
    throw new Error(msg);
  }

  let barcode = payment.identificationField || payment.nossoNumero || '';
  let pixQrCode = '';
  let pixCopyPaste = '';

  try {
    const [boletoRes, pixRes] = await Promise.all([
      fetch(`${baseUrl}/v3/payments/${payment.id}/identificationField`, {
        headers: headers(apiKey),
      }),
      fetch(`${baseUrl}/v3/payments/${payment.id}/pixQrCode`, {
        headers: headers(apiKey),
      }),
    ]);

    if (boletoRes.ok) {
      const boletoData = await boletoRes.json();
      if (boletoData.identificationField || boletoData.barCode) {
        barcode = boletoData.identificationField || boletoData.barCode || barcode;
      }
    }

    if (pixRes.ok) {
      const pixData = await pixRes.json();
      pixCopyPaste = pixData.payload || '';
      pixQrCode = pixData.encodedImage || '';
    }
  } catch {
    // identificationField and pixQrCode may not be ready immediately
  }

  return {
    externalId: payment.id,
    barcode,
    pixQrCode,
    pixCopyPaste,
    billetPdfUrl: payment.bankSlipUrl || '',
    paymentUrl: payment.invoiceUrl || payment.bankSlipUrl || '',
    status: payment.status || 'PENDING',
  };
}

export async function getAsaasCharge(externalId: string): Promise<ChargeResponse> {
  const { apiKey, baseUrl } = await getConfig();
  const response = await fetch(`${baseUrl}/v3/payments/${encodeURIComponent(externalId)}`, {
    headers: headers(apiKey),
  });
  const payment = await response.json();
  if (!response.ok) throw new Error('Não foi possível consultar a cobrança no Asaas');

  let pixCopyPaste = '';
  let pixQrCode = '';
  try {
    const pixRes = await fetch(`${baseUrl}/v3/payments/${externalId}/pixQrCode`, {
      headers: headers(apiKey),
    });
    if (pixRes.ok) {
      const pixData = await pixRes.json();
      pixCopyPaste = pixData.payload || '';
      pixQrCode = pixData.encodedImage || '';
    }
  } catch {
    // PIX data may not be available
  }

  return {
    externalId,
    barcode: payment.identificationField || '',
    pixQrCode,
    pixCopyPaste,
    billetPdfUrl: payment.bankSlipUrl || '',
    paymentUrl: payment.invoiceUrl || payment.bankSlipUrl || '',
    status: payment.status === 'RECEIVED' || payment.status === 'CONFIRMED' ? 'PAID' : 'PENDING',
  };
}

export async function cancelAsaasCharge(externalId: string) {
  const { apiKey, baseUrl } = await getConfig();
  const response = await fetch(`${baseUrl}/v3/payments/${encodeURIComponent(externalId)}`, {
    method: 'DELETE',
    headers: headers(apiKey),
  });
  if (!response.ok) throw new Error('Não foi possível cancelar a cobrança no Asaas');
}
