/**
 * InterClient — Banco Inter Cobranças API (mTLS)
 *
 * Base URLs:
 * - Produção: https://cdpj.partners.bancointer.com.br
 * - Sandbox:  https://cdpj-sandbox.partners.bancointer.com.br
 *
 * mTLS: certificado .crt + chave .key são decodificados de base64
 * e usados num https.Agent para todas as requisições.
 */

import fs from 'fs';
import https from 'https';
import fetch from 'node-fetch';
import { supabaseAdmin } from '@/lib/supabase';

export type InterConfig = {
  clientId: string;
  clientSecret: string;
  certBase64: string;
  keyBase64: string;
  sandbox: boolean;
};

export type InterChargeInput = {
  seuNumero: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  pagador: {
    cpfCnpj: string;
    nome: string;
    email?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
  };
  mensagem?: string;
};

export type InterChargeResponse = {
  codigoSolicitacao: string;
  linhaDigitavel: string;
  pixCopiaECola: string;
  seuNumero: string;
  situacao: string;
  barcode: string;
  pdfUrl: string;
};

const CERT_PATH = '/tmp/inter-cert.crt';
const KEY_PATH = '/tmp/inter-key.key';

const INTER_PROD_URL = 'https://cdpj.partners.bancointer.com.br';
const INTER_SANDBOX_URL = 'https://cdpj-sandbox.partners.bancointer.com.br';

let cachedConfig: InterConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_MS = 10000;

let cachedAgent: https.Agent | null = null;
let agentConfigHash = '';

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function loadInterConfig(): Promise<InterConfig> {
  const now = Date.now();
  if (cachedConfig && now - configCacheTime < CONFIG_CACHE_MS) {
    return cachedConfig;
  }

  let cfg: InterConfig = {
    clientId: process.env.INTER_CLIENT_ID || '',
    clientSecret: process.env.INTER_CLIENT_SECRET || '',
    certBase64: '',
    keyBase64: '',
    sandbox: process.env.INTER_SANDBOX === 'true',
  };

  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('inter_client_id, inter_client_secret, inter_cert_base64, inter_key_base64, inter_sandbox')
      .eq('id', 1)
      .maybeSingle();

    if (data) {
      if (data.inter_client_id) cfg.clientId = data.inter_client_id;
      if (data.inter_client_secret) cfg.clientSecret = data.inter_client_secret;
      if (data.inter_cert_base64) cfg.certBase64 = data.inter_cert_base64;
      if (data.inter_key_base64) cfg.keyBase64 = data.inter_key_base64;
      if (data.inter_sandbox !== null) cfg.sandbox = data.inter_sandbox;
    }
  } catch {
    // Banco indisponível — usa env vars
  }

  cachedConfig = cfg;
  configCacheTime = now;
  return cfg;
}

export async function isInterConfigured(): Promise<boolean> {
  const cfg = await loadInterConfig();
  return !!(cfg.clientId && cfg.clientSecret && cfg.certBase64 && cfg.keyBase64);
}

function getBaseUrl(cfg: InterConfig): string {
  return cfg.sandbox ? INTER_SANDBOX_URL : INTER_PROD_URL;
}

function getHttpsAgent(cfg: InterConfig): https.Agent | null {
  const hash = `${cfg.certBase64.length}-${cfg.keyBase64.length}`;
  if (cachedAgent && agentConfigHash === hash) return cachedAgent;

  if (!cfg.certBase64 || !cfg.keyBase64) return null;

  fs.writeFileSync(CERT_PATH, Buffer.from(cfg.certBase64, 'base64'));
  fs.writeFileSync(KEY_PATH, Buffer.from(cfg.keyBase64, 'base64'));

  cachedAgent = new https.Agent({
    cert: fs.readFileSync(CERT_PATH),
    key: fs.readFileSync(KEY_PATH),
    rejectUnauthorized: true,
    keepAlive: true,
  });
  agentConfigHash = hash;

  return cachedAgent;
}

export async function getInterToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const cfg = await loadInterConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('Banco Inter: client_id e client_secret não configurados');
  }

  const baseUrl = getBaseUrl(cfg);
  const agent = getHttpsAgent(cfg);

  if (!agent) {
    throw new Error('Banco Inter: certificado .crt e chave .key não carregados. Faça upload dos arquivos nas Configurações.');
  }

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'boleto-cobranca.read boleto-cobranca.write',
    grant_type: 'client_credentials',
  });

  let response: fetch.Response;
  try {
    response = await fetch(`${baseUrl}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      agent,
      timeout: 15000,
    } as any);
  } catch (fetchError) {
    const cause = (fetchError as any)?.cause;
    const causeMsg = cause instanceof Error ? cause.message : String(cause ?? '');
    console.error('[InterAuth] Falha de rede:', causeMsg || fetchError);
    throw new Error(
      `Não foi possível conectar à API do Banco Inter (${cfg.sandbox ? 'Sandbox' : 'Produção'}). ` +
      `Verifique se o certificado .crt e a chave .key foram carregados corretamente. ` +
      `Detalhe: ${causeMsg || (fetchError instanceof Error ? fetchError.message : String(fetchError))}`
    );
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error('[InterAuth] Falha na autenticação:', response.status, errText.slice(0, 500));
    throw new Error(`Inter auth failed: ${response.status} ${errText.slice(0, 200)}`);
  }

  const rawText = await response.text();
  if (rawText.trimStart().startsWith('<') || rawText.trimStart().startsWith('<!doctype')) {
    throw new Error(`Inter: endpoint ${baseUrl}/oauth/v2/token retornou HTML em vez de JSON. URL incorreta.`);
  }

  const data = JSON.parse(rawText);
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

export async function createInterCharge(input: InterChargeInput): Promise<InterChargeResponse> {
  const cfg = await loadInterConfig();
  const token = await getInterToken();
  const baseUrl = getBaseUrl(cfg);
  const agent = getHttpsAgent(cfg);

  if (!agent) {
    throw new Error('Banco Inter: certificado mTLS não carregado.');
  }

  const cpfCnpj = input.pagador.cpfCnpj.replace(/\D/g, '');
  if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
    throw new Error(
      `Cliente "${input.pagador.nome}" sem CPF/CNPJ válido. ` +
      `O boleto do Inter exige CPF (11 dígitos) ou CNPJ (14 dígitos).`
    );
  }

  const body: Record<string, unknown> = {
    seuNumero: String(input.seuNumero).substring(0, 15),
    valorNominal: Number(input.valor.toFixed(2)),
    dataVencimento: input.vencimento,
    numDiasAgenda: 60,
    pagador: {
      cpfCnpj,
      nome: input.pagador.nome.substring(0, 100),
      email: input.pagador.email || undefined,
      cidade: input.pagador.cidade || undefined,
      uf: input.pagador.uf || undefined,
      cep: input.pagador.cep || undefined,
      endereco: input.pagador.endereco || undefined,
      numero: input.pagador.numero || undefined,
      bairro: input.pagador.bairro || undefined,
    },
    mensagem: { linha1: input.mensagem || 'Pagamento' },
  };

  const cleanBody = JSON.parse(JSON.stringify(body));
  console.log('[Inter] Criando cobrança — seuNumero:', input.seuNumero, '| valor:', input.valor);

  let response: fetch.Response;
  try {
    response = await fetch(`${baseUrl}/cobrancas/v3/cobrancas`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cleanBody),
      agent,
      timeout: 30000,
    } as any);
  } catch (fetchError) {
    const cause = (fetchError as any)?.cause;
    const causeMsg = cause instanceof Error ? cause.message : String(cause ?? '');
    throw new Error(`Erro de rede ao criar cobrança no Inter: ${causeMsg || fetchError}`);
  }

  const rawText = await response.text();

  if (rawText.trimStart().startsWith('<') || rawText.trimStart().startsWith('<!doctype')) {
    console.error('[Inter] Resposta HTML em vez de JSON:', rawText.slice(0, 300));
    throw new Error('Banco Inter retornou HTML em vez de JSON. URL pode estar incorreta.');
  }

  if (!response.ok) {
    let errMsg = rawText;
    try {
      const errJson = JSON.parse(rawText);
      errMsg = errJson.message || errJson.error || errJson.description || rawText;
    } catch {
      // mantém rawText
    }
    console.error('[Inter] Erro ao criar cobrança:', response.status, errMsg.slice(0, 300));
    throw new Error(`Inter ${response.status}: ${errMsg.slice(0, 300)}`);
  }

  const data = JSON.parse(rawText);
  console.log('[Inter] Cobrança criada:', JSON.stringify(data, null, 2));

  return {
    codigoSolicitacao: String(data.codigoSolicitacao || data.solicitacao || ''),
    linhaDigitavel: data.linhaDigitavel || data.linha_digitavel || '',
    pixCopiaECola: data.pixCopiaECola || data.pix_copia_e_cola || '',
    seuNumero: input.seuNumero,
    situacao: data.situacao || 'EM_PROCESSAMENTO',
    barcode: data.linhaDigitavel || '',
    pdfUrl: data.pdfUrl || data.pdf_url || '',
  };
}

export async function getInterCharge(codigoSolicitacao: string): Promise<InterChargeResponse> {
  const cfg = await loadInterConfig();
  const token = await getInterToken();
  const baseUrl = getBaseUrl(cfg);
  const agent = getHttpsAgent(cfg);

  if (!agent) throw new Error('Banco Inter: certificado mTLS não carregado.');

  const response = await fetch(`${baseUrl}/cobrancas/v3/cobrancas/${codigoSolicitacao}`, {
    headers: { Authorization: `Bearer ${token}` },
    agent,
    timeout: 15000,
  } as any);

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Inter getCharge ${response.status}: ${rawText.slice(0, 200)}`);
  }

  const data = JSON.parse(rawText);

  return {
    codigoSolicitacao: String(data.codigoSolicitacao || codigoSolicitacao),
    linhaDigitavel: data.linhaDigitavel || '',
    pixCopiaECola: data.pixCopiaECola || '',
    seuNumero: data.seuNumero || '',
    situacao: data.situacao || 'unknown',
    barcode: data.linhaDigitavel || '',
    pdfUrl: data.pdfUrl || '',
  };
}

export async function cancelInterCharge(codigoSolicitacao: string, motivo?: string): Promise<void> {
  const cfg = await loadInterConfig();
  const token = await getInterToken();
  const baseUrl = getBaseUrl(cfg);
  const agent = getHttpsAgent(cfg);

  if (!agent) throw new Error('Banco Inter: certificado mTLS não carregado.');

  await fetch(`${baseUrl}/cobrancas/v3/cobrancas/${codigoSolicitacao}/cancelar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ motivoCancelamento: motivo || 'ACERTOS' }),
    agent,
    timeout: 15000,
  } as any);
}

export function invalidateInterConfig(): void {
  cachedConfig = null;
  configCacheTime = 0;
  cachedAgent = null;
  agentConfigHash = '';
  cachedToken = null;
}

export function handleInterWebhook(payload: Record<string, unknown>): {
  status: string;
  method: string;
  codigo: string;
} {
  const codigoSolicitacao = String(payload.codigoSolicitacao || '');
  const situacao = String(payload.situacao || '');
  const tipoPagamento = String(payload.tipoPagamento || '');

  return {
    status: situacao === 'PAGO' ? 'PAID' : situacao,
    method: tipoPagamento,
    codigo: codigoSolicitacao,
  };
}
