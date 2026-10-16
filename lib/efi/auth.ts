/**
 * EfiAuthService — Autenticação OAuth2 com mTLS na API Efí Bank
 *
 * Pix endpoints (produção): https://pix.api.efipay.com.br
 * Boleto endpoints (produção): https://cobrancas.api.efipay.com.br
 * Sandbox Pix: https://sandbox.pix.api.efipay.com.br
 * Sandbox Boleto: https://sandbox.cobrancas.api.efipay.com.br
 *
 * mTLS: o certificado .p12 (sem senha) é convertido para PEM temporário
 * e usado num https.Agent para todas as requisições.
 */

import fs from 'fs';
import https from 'https';
import fetch from 'node-fetch';
import { supabaseAdmin } from '@/lib/supabase';

export type EfiConfig = {
  clientId: string;
  clientSecret: string;
  pixKey: string;
  certificateBase64: string;
  sandbox: boolean;
};

export type EfiToken = {
  token: string;
  expiresAt: number;
  tokenType: string;
};

const PIX_PROD_URL = 'https://pix.api.efipay.com.br';
const BOLETO_PROD_URL = 'https://cobrancas.api.efipay.com.br';
const PIX_SANDBOX_URL = 'https://sandbox.pix.api.efipay.com.br';
const BOLETO_SANDBOX_URL = 'https://sandbox.cobrancas.api.efipay.com.br';

const CERT_PATH = '/tmp/efi-cert.p12';

let cachedToken: EfiToken | null = null;
let cachedBoletoToken: EfiToken | null = null;
let cachedConfig: EfiConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_MS = 10000;

let cachedAgent: https.Agent | null = null;

/** Carrega configuração EFI do banco (settings) com fallback para env vars */
export async function loadEfiConfig(): Promise<EfiConfig> {
  const now = Date.now();
  if (cachedConfig && now - configCacheTime < CONFIG_CACHE_MS) {
    return cachedConfig;
  }

  let cfg: EfiConfig = {
    clientId: process.env.EFI_CLIENT_ID || '',
    clientSecret: process.env.EFI_CLIENT_SECRET || '',
    pixKey: process.env.EFI_PIX_KEY || '',
    certificateBase64: '',
    sandbox: process.env.EFI_SANDBOX === 'true',
  };

  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('efi_client_id, efi_client_secret, efi_pix_key, efi_certificate_base64, efi_sandbox')
      .eq('id', 1)
      .maybeSingle();

    if (data) {
      if (data.efi_client_id) cfg.clientId = data.efi_client_id;
      if (data.efi_client_secret) cfg.clientSecret = data.efi_client_secret;
      if (data.efi_pix_key) cfg.pixKey = data.efi_pix_key;
      if (data.efi_certificate_base64) cfg.certificateBase64 = data.efi_certificate_base64;
      if (data.efi_sandbox !== null) cfg.sandbox = data.efi_sandbox;
    }
  } catch {
    // Banco indisponível — usa env vars
  }

  cachedConfig = cfg;
  configCacheTime = now;
  return cfg;
}

/**
 * Escreve o certificado .p12 no disco (a partir do base64 do banco)
 * e cria um https.Agent com mTLS para usar nas requisições.
 */
function getHttpsAgent(cfg: EfiConfig): https.Agent | null {
  if (cachedAgent) return cachedAgent;

  if (!cfg.certificateBase64) {
    return null;
  }

  const certBuffer = Buffer.from(cfg.certificateBase64, 'base64');
  fs.writeFileSync(CERT_PATH, certBuffer);

  const pfx = fs.readFileSync(CERT_PATH);
  cachedAgent = new https.Agent({
    pfx,
    passphrase: '',
    minVersion: 'TLSv1.2',
    keepAlive: true,
  });

  return cachedAgent;
}

/** URL base para endpoints Pix */
export async function getPixBaseUrl(): Promise<string> {
  const cfg = await loadEfiConfig();
  return cfg.sandbox ? PIX_SANDBOX_URL : PIX_PROD_URL;
}

/** URL base para endpoints de Boleto/Carnê */
export async function getBoletoBaseUrl(): Promise<string> {
  const cfg = await loadEfiConfig();
  return cfg.sandbox ? BOLETO_SANDBOX_URL : BOLETO_PROD_URL;
}

/** URL base genérica (legacy — usa a do Pix) */
export async function getBaseUrl(): Promise<string> {
  return getPixBaseUrl();
}

/** Verifica se a EFI está configurada */
export async function isEfiConfigured(): Promise<boolean> {
  const cfg = await loadEfiConfig();
  return !!(cfg.clientId && cfg.clientSecret);
}

/**
 * Autentica na API Efí e retorna o token de acesso.
 * Usa mTLS com o certificado .p12.
 */
export async function authenticate(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const cfg = await loadEfiConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('EFI: client_id e client_secret não configurados');
  }

  const baseUrl = cfg.sandbox ? PIX_SANDBOX_URL : PIX_PROD_URL;
  const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const agent = getHttpsAgent(cfg);

  let response: fetch.Response;
  try {
    response = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
      ...(agent ? { agent } : {}),
      timeout: 15000,
    } as any);
  } catch (fetchError) {
    const cause = (fetchError as any)?.cause;
    const causeMsg = cause instanceof Error ? cause.message : String(cause ?? '');
    console.error('[EfiAuth] Falha de rede:', causeMsg || fetchError);
    throw new Error(
      `Não foi possível conectar à API da Efí (${cfg.sandbox ? 'Homologação' : 'Produção'}). ` +
      `Verifique se o certificado .p12 foi carregado e se as credenciais estão corretas. ` +
      `Detalhe: ${causeMsg || (fetchError instanceof Error ? fetchError.message : String(fetchError))}`
    );
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error('[EfiAuth] Falha na autenticação:', response.status, errText.slice(0, 500));
    if (response.status === 403) {
      const isHtml = errText.trimStart().startsWith('<');
      throw new Error(
        `EFI 403 — Acesso negado pela Efí.\n` +
        `URL chamada: ${baseUrl}/oauth/token\n` +
        `Ambiente: ${cfg.sandbox ? 'Homologação (Sandbox)' : 'Produção'}\n` +
        `Client ID: ${cfg.clientId.substring(0, 12)}...\n` +
        `Certificado mTLS: ${agent ? 'enviado' : 'NÃO enviado — faça upload do .p12'}\n` +
        `Resposta ${isHtml ? 'HTML (endpoint errado ou certificado inválido)' : 'JSON'}: ${errText.slice(0, 200)}\n` +
        `Verifique:\n` +
        `  - O Client ID começa com "Client_Id_" (produção) e não "Client_Id_" de sandbox\n` +
        `  - O certificado .p12 é o de PRODUÇÃO (producao-XXXXXX.p12)\n` +
        `  - O ambiente está correto (Produção vs Homologação)`
      );
    }
    throw new Error(`EFI auth failed: ${response.status} ${errText.slice(0, 200)}`);
  }

  const rawText = await response.text();
  if (rawText.trimStart().startsWith('<') || rawText.trimStart().startsWith('<!doctype')) {
    console.error('[EfiAuth] Resposta HTML em vez de JSON:', rawText.slice(0, 300));
    throw new Error(`EFI: endpoint ${baseUrl}/oauth/token retornou HTML em vez de JSON. URL incorreta.`);
  }
  const data = JSON.parse(rawText);
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    tokenType: data.token_type || 'Bearer',
  };

  return data.access_token;
}

/**
 * Faz uma requisição autenticada para a API Efí (endpoints Pix).
 * Usa mTLS + Bearer token automaticamente.
 */
export async function efiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await authenticate();
  const cfg = await loadEfiConfig();
  const baseUrl = cfg.sandbox ? PIX_SANDBOX_URL : PIX_PROD_URL;
  const agent = getHttpsAgent(cfg);

  const nodeRes = await fetch(`${baseUrl}${path}`, {
    method: (options.method as any) || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
    body: options.body as any,
    ...(agent ? { agent } : {}),
    timeout: 30000,
  } as any);

  return nodeRes as unknown as Response;
}

/**
 * Versão de efiFetch que já faz parse do JSON e trata erros.
 */
export async function efiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await efiFetch(path, options);

  const rawText = await response.text();

  if (rawText.trimStart().startsWith('<') || rawText.trimStart().startsWith('<!doctype')) {
    console.error(`[EfiRequest] ${options.method || 'GET'} ${path} -> ${response.status}: EFI retornou HTML em vez de JSON`);
    throw new Error(`EFI retornou HTML em vez de JSON. URL do PIX pode estar incorreta. Resposta: ${rawText.slice(0, 200)}`);
  }

  if (!response.ok) {
    let errMsg = rawText;
    try {
      const errJson = JSON.parse(rawText);
      errMsg = errJson.error_description || errJson.error || errJson.mensagem || rawText;
    } catch {
      // mantém rawText
    }
    console.error(`[EfiRequest] ${options.method || 'GET'} ${path} -> ${response.status}: ${errMsg}`);
    throw new Error(`EFI ${response.status}: ${errMsg.slice(0, 300)}`);
  }

  return JSON.parse(rawText) as T;
}

/**
 * Faz uma requisição autenticada para endpoints de Boleto/Carnê da Efí.
 * Usa a URL https://cobrancas.api.efipay.com.br (não a do Pix) e token próprio.
 */
export async function efiBoletoFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await authenticateBoleto();
  const cfg = await loadEfiConfig();
  const baseUrl = cfg.sandbox ? BOLETO_SANDBOX_URL : BOLETO_PROD_URL;
  const agent = getHttpsAgent(cfg);

  const nodeRes = await fetch(`${baseUrl}${path}`, {
    method: (options.method as any) || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
    body: options.body as any,
    ...(agent ? { agent } : {}),
    timeout: 30000,
  } as any);

  return nodeRes as unknown as Response;
}

/**
 * Versão de efiBoletoFetch que já faz parse do JSON e trata erros.
 * Detecta respostas HTML (URL incorreta) e lança erro claro em vez de quebrar com "invalid json".
 */
export async function efiBoletoRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await efiBoletoFetch(path, options);

  const rawText = await response.text();

  if (rawText.trimStart().startsWith('<') || rawText.trimStart().startsWith('<!doctype')) {
    console.error(`[EfiBoletoRequest] ${options.method || 'GET'} ${path} -> ${response.status}: EFI retornou HTML em vez de JSON`);
    throw new Error(`EFI retornou HTML em vez de JSON. URL do boleto pode estar incorreta. Resposta: ${rawText.slice(0, 200)}`);
  }

  if (!response.ok) {
    let errMsg = rawText;
    try {
      const errJson = JSON.parse(rawText);
      errMsg = errJson.error_description || errJson.error || errJson.mensagem || rawText;
    } catch {
      // mantém rawText
    }
    console.error(`[EfiBoletoRequest] ${options.method || 'GET'} ${path} -> ${response.status}: ${errMsg}`);
    throw new Error(`EFI ${response.status}: ${errMsg.slice(0, 300)}`);
  }

  return JSON.parse(rawText) as T;
}

/** Invalida o cache de token (útil quando recebe 401) */
export function invalidateToken(): void {
  cachedToken = null;
}

/** Invalida o cache de config e agent (útil após salvar novas credenciais) */
export function invalidateConfig(): void {
  cachedConfig = null;
  configCacheTime = 0;
  cachedAgent = null;
  cachedToken = null;
  cachedBoletoToken = null;
}

/**
 * Autentica na API Efí para endpoints de BOLETO usando a URL correta.
 * A Efí usa base URLs diferentes para Pix (pix.api.efipay.com.br)
 * e para boleto (cobrancas.api.efipay.com.br) — os tokens são separados.
 */
export async function authenticateBoleto(): Promise<string> {
  if (cachedBoletoToken && Date.now() < cachedBoletoToken.expiresAt) {
    return cachedBoletoToken.token;
  }

  const cfg = await loadEfiConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('EFI: client_id e client_secret não configurados');
  }

  const baseUrl = cfg.sandbox ? BOLETO_SANDBOX_URL : BOLETO_PROD_URL;
  const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const agent = getHttpsAgent(cfg);

  console.log(`[EfiAuth Boleto] Autenticando em ${baseUrl}/oauth/token (sandbox: ${cfg.sandbox})`);

  let response: fetch.Response;
  try {
    response = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
      ...(agent ? { agent } : {}),
      timeout: 15000,
    } as any);
  } catch (fetchError) {
    const cause = (fetchError as any)?.cause;
    const causeMsg = cause instanceof Error ? cause.message : String(cause ?? '');
    console.warn('[EfiAuth Boleto] Falha de rede no endpoint de boleto, tentando token do PIX como fallback');

    // Fallback: usa o token do PIX (mesmas credenciais, funciona para boleto)
    try {
      const pixToken = await authenticate();
      console.log('[EfiAuth Boleto] Usando token do PIX como fallback');
      cachedBoletoToken = cachedToken;
      return pixToken;
    } catch {
      throw new Error(
        `Não foi possível conectar à API Efí Boleto (${cfg.sandbox ? 'Homologação' : 'Produção'}). ` +
        `Detalhe: ${causeMsg || (fetchError instanceof Error ? fetchError.message : String(fetchError))}`
      );
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    console.warn('[EfiAuth Boleto] Falha na autenticação:', response.status, errText.slice(0, 200));
    console.warn('[EfiAuth Boleto] Tentando token do PIX como fallback');

    try {
      const pixToken = await authenticate();
      console.log('[EfiAuth Boleto] Usando token do PIX como fallback');
      cachedBoletoToken = cachedToken;
      return pixToken;
    } catch {
      throw new Error(`EFI Boleto auth failed: ${response.status} ${errText.slice(0, 200)}`);
    }
  }

  const rawText = await response.text();
  if (rawText.trimStart().startsWith('<') || rawText.trimStart().startsWith('<!doctype')) {
    console.error('[EfiAuth Boleto] Resposta HTML em vez de JSON:', rawText.slice(0, 300));
    console.warn('[EfiAuth Boleto] Tentando token do PIX como fallback');
    const pixToken = await authenticate();
    cachedBoletoToken = cachedToken;
    return pixToken;
  }

  const data = JSON.parse(rawText);
  cachedBoletoToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    tokenType: data.token_type || 'Bearer',
  };

  console.log('[EfiAuth Boleto] Token obtido com sucesso');
  return data.access_token;
}
