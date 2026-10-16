/**
 * WhatsApp integration via Evolution API (self-hosted WhatsApp Web API)
 *
 * Configuration is loaded from two sources, with env vars as fallback:
 *   1. Database settings table (set via the WhatsApp config page UI)
 *   2. Environment variables: EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME
 */

import { supabaseAdmin } from './supabase';

type EvoConfig = {
  url: string;
  apiKey: string;
  instance: string;
};

let cachedConfig: EvoConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_MS = 10000; // 10s — avoids a DB hit on every message send

async function loadConfig(): Promise<EvoConfig> {
  const now = Date.now();
  if (cachedConfig && now - configCacheTime < CONFIG_CACHE_MS) {
    return cachedConfig;
  }

  // Defaults from env vars
  let url = process.env.EVOLUTION_API_URL || '';
  let apiKey = process.env.EVOLUTION_API_KEY || '';
  let instance = process.env.EVOLUTION_INSTANCE_NAME || 'cobrancapro';

  // Override with DB settings if available
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('evolution_api_url, evolution_api_key, evolution_instance_name')
      .eq('id', 1)
      .maybeSingle();

    if (data) {
      if (data.evolution_api_url) url = data.evolution_api_url;
      if (data.evolution_api_key) apiKey = data.evolution_api_key;
      if (data.evolution_instance_name) instance = data.evolution_instance_name;
    }
  } catch {
    // DB not available — fall back to env vars silently
  }

  cachedConfig = { url, apiKey, instance };
  configCacheTime = now;
  return cachedConfig;
}

async function getHeaders(): Promise<Record<string, string>> {
  const cfg = await loadConfig();
  return {
    'Content-Type': 'application/json',
    apikey: cfg.apiKey,
  };
}

/**
 * Format a Brazilian phone number to the international format expected by WhatsApp:
 *   55 + DDD (2 digits) + number (8 or 9 digits)
 *
 * Rules:
 * - Strip all non-digit characters
 * - If already starts with 55 and has 12-13 digits, use as-is (but add 9 for mobiles if missing)
 * - If starts with 55 and has 12 digits (55 + 2 DDD + 8), check if it's a mobile (starts with 6-9 after DDD) and insert 9
 * - If doesn't start with 55, prepend 55
 * - If 10 digits (DDD + 8-digit landline), add 55 prefix only
 * - If 11 digits (DDD + 9 + 8-digit mobile), add 55 prefix
 * - If 11 digits starting with 6-9 after DDD but no 9th digit, insert the 9
 */
export function formatBrazilianPhone(phone: string): string {
  // Remove everything except digits
  let cleaned = phone.replace(/\D/g, '');

  // Remove leading 55 country code if present, then re-add it consistently
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    cleaned = cleaned.slice(2);
  }

  // Now cleaned should be DDD + number (10 or 11 digits)
  // 11 digits = DDD + 9 + 8-digit mobile (already has the 9)
  // 10 digits = DDD + 8-digit number (need to add 9 for mobiles)
  if (cleaned.length === 10) {
    const ddd = cleaned.slice(0, 2);
    const numberPart = cleaned.slice(2);
    // Brazilian mobiles start with 6-9 after DDD
    const firstDigit = numberPart[0];
    if (firstDigit && parseInt(firstDigit, 10) >= 6) {
      // Mobile without the 9 — insert it
      return `55${ddd}9${numberPart}`;
    }
    // Landline — just add 55
    return `55${cleaned}`;
  }

  if (cleaned.length === 11) {
    return `55${cleaned}`;
  }

  // Fallback — just prepend 55
  return `55${cleaned}`;
}

async function loadAtendimentoInstance(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('evolution_instance_atendimento')
      .eq('id', 1)
      .maybeSingle();
    return data?.evolution_instance_atendimento || 'bot-atendimento';
  } catch {
    return 'bot-atendimento';
  }
}

export async function sendWhatsAppTextAtendimento(phone: string, message: string): Promise<boolean> {
  const cfg = await loadConfig();
  if (!cfg.url) return false;
  const instance = await loadAtendimentoInstance();
  const fullPhone = formatBrazilianPhone(phone);
  try {
    const response = await fetch(`${cfg.url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ number: fullPhone, text: message }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Send a text message via WhatsApp
 */
export async function sendWhatsAppText(phone: string, message: string): Promise<boolean> {
  const cfg = await loadConfig();
  if (!cfg.url) {
    console.warn('[WhatsApp] EVOLUTION_API_URL not configured');
    return false;
  }

  const fullPhone = formatBrazilianPhone(phone);

  try {
    console.log(`[WhatsApp] Sending to ${fullPhone} via ${cfg.url}/message/sendText/${cfg.instance}`);
    const response = await fetch(
      `${cfg.url}/message/sendText/${cfg.instance}`,
      {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          number: fullPhone,
          text: message,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[WhatsApp] sendText failed: ${response.status} ${errText}`);
      return false;
    }

    console.log('[WhatsApp] Message sent successfully');
    return true;
  } catch (err) {
    console.error('[WhatsApp] sendText error:', err);
    return false;
  }
}

/**
 * Send a media message (image/PDF) via WhatsApp with an optional caption
 */
export async function sendWhatsAppMedia(
  phone: string,
  message: string,
  fileUrl?: string,
  fileName?: string
): Promise<boolean> {
  const cfg = await loadConfig();
  if (!cfg.url) {
    console.warn('[WhatsApp] EVOLUTION_API_URL not configured');
    return false;
  }

  const fullPhone = formatBrazilianPhone(phone);

  try {
    if (fileUrl) {
      const isPdf = fileUrl.toLowerCase().endsWith('.pdf');
      const body = isPdf
        ? {
            number: fullPhone,
            documentMessage: {
              document: fileUrl,
              fileName: fileName || 'boleto.pdf',
              caption: message,
            },
          }
        : {
            number: fullPhone,
            imageMessage: {
              image: fileUrl,
              caption: message,
            },
          };

      const response = await fetch(
        `${cfg.url}/message/sendMedia/${cfg.instance}`,
        {
          method: 'POST',
          headers: await getHeaders(),
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[WhatsApp] sendMedia failed: ${response.status} ${errText}`);
        return sendWhatsAppText(phone, message);
      }

      return true;
    }

    return sendWhatsAppText(phone, message);
  } catch (err) {
    console.error('[WhatsApp] sendMedia error:', err);
    return sendWhatsAppText(phone, message);
  }
}

export type WhatsAppConnectionInfo = {
  status: string;
  base64?: string;
  phoneNumber?: string;
  instanceName?: string;
};

/**
 * Get QR code for connecting a WhatsApp instance.
 * Returns the QR code base64 and current status.
 * If already connected, returns status "open" with the connected phone number.
 */
export async function getQRCode(): Promise<WhatsAppConnectionInfo | null> {
  const cfg = await loadConfig();
  if (!cfg.url) {
    return null;
  }

  try {
    const response = await fetch(
      `${cfg.url}/instance/connect/${cfg.instance}`,
      {
        headers: await getHeaders(),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Evolution API v1/v2 response shapes
    if (data.instance) {
      const state = data.instance.state || data.status || 'close';
      if (state === 'open' || state === 'connected') {
        return {
          status: 'open',
          phoneNumber: data.instance.wid?.split(':')[0] || data.instance.phone || '',
          instanceName: data.instance.name || cfg.instance,
        };
      }
    }

    if (data.qrcode) {
      return {
        base64: data.qrcode.base64 || data.qrcode.code || '',
        status: data.status || 'connecting',
        instanceName: cfg.instance,
      };
    }

    return {
      base64: '',
      status: data.status || data.instance?.state || 'close',
      instanceName: cfg.instance,
    };
  } catch (err) {
    console.error('[WhatsApp] getQRCode error:', err);
    return null;
  }
}

/**
 * Get current connection status of the WhatsApp instance.
 * Uses the connectionState endpoint for a lightweight status check.
 * Returns status string and optionally the phone number when connected.
 */
export async function getConnectionStatus(): Promise<WhatsAppConnectionInfo> {
  const cfg = await loadConfig();
  if (!cfg.url) {
    return { status: 'not_configured' };
  }

  try {
    // Use the lightweight connectionState endpoint
    const stateRes = await fetch(
      `${cfg.url}/instance/connectionState/${cfg.instance}`,
      {
        headers: await getHeaders(),
      }
    );

    if (stateRes.ok) {
      const stateData = await stateRes.json();
      const state = stateData.instance?.state || stateData.state || stateData.status || 'close';

      if (state === 'open' || state === 'connected') {
        // Fetch full instance info for phone number
        let phoneNumber = '';
        let profilePic = '';
        try {
          const infoRes = await fetch(
            `${cfg.url}/instance/fetchInstances/${cfg.instance}`,
            { headers: await getHeaders() }
          );
          if (infoRes.ok) {
            const infoData = await infoRes.json();
            const inst = Array.isArray(infoData) ? infoData[0] : infoData;
            phoneNumber = inst?.instance?.wid?.split(':')[0] || inst?.instance?.phone || '';
            profilePic = inst?.instance?.profilePicUrl || inst?.instance?.profile || '';
          }
        } catch {
          // ignore — we have the state at least
        }

        return {
          status: 'open',
          phoneNumber,
          instanceName: cfg.instance,
          base64: profilePic || undefined,
        };
      }

      return { status: state, instanceName: cfg.instance };
    }

    return { status: 'close' };
  } catch {
    return { status: 'close' };
  }
}

/**
 * Create a new WhatsApp instance in the Evolution API.
 * Uses the /instance/create endpoint with WhatsApp Baileys integration.
 */
export async function createInstance(): Promise<{ success: boolean; message: string }> {
  const cfg = await loadConfig();
  if (!cfg.url) {
    return { success: false, message: 'EVOLUTION_API_URL não configurada' };
  }

  try {
    const response = await fetch(
      `${cfg.url}/instance/create`,
      {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          instanceName: cfg.instance,
          integration: 'WHATSAPP-BAILEYS',
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      // If instance already exists, that's OK
      if (response.status === 409 || errText.includes('already exists')) {
        return { success: true, message: 'Instância já existe' };
      }
      return { success: false, message: `Erro ${response.status}: ${errText}` };
    }

    return { success: true, message: 'Instância criada com sucesso' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

/**
 * Disconnect the WhatsApp instance (logout).
 * Calls the Evolution API to close the connection.
 */
export async function disconnectWhatsApp(): Promise<boolean> {
  const cfg = await loadConfig();
  if (!cfg.url) {
    return false;
  }

  try {
    const response = await fetch(
      `${cfg.url}/instance/logout/${cfg.instance}`,
      {
        method: 'DELETE',
        headers: await getHeaders(),
      }
    );

    if (!response.ok) {
      // Try alternative endpoint for older Evolution API versions
      const altResponse = await fetch(
        `${cfg.url}/instance/disconnect/${cfg.instance}`,
        {
          method: 'POST',
          headers: await getHeaders(),
        }
      );
      return altResponse.ok;
    }

    return true;
  } catch (err) {
    console.error('[WhatsApp] disconnect error:', err);
    return false;
  }
}

/**
 * Main function to send a WhatsApp notification for a charge
 */
export async function sendWhatsApp(
  phone: string,
  message: string,
  fileUrl?: string
): Promise<boolean> {
  if (fileUrl) {
    return sendWhatsAppMedia(phone, message, fileUrl, 'boleto.pdf');
  }
  return sendWhatsAppText(phone, message);
}
