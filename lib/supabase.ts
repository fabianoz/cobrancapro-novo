import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
      );
    }
    return Reflect.get(_supabase, prop);
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
      _supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    }
    return Reflect.get(_supabaseAdmin, prop);
  },
});

export type Empresa = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  email: string | null;
  whatsapp: string | null;
  plano: string;
  status: string;
  logo_url: string | null;
  subdomain: string | null;
  max_users: number;
  created_at: string;
};

export type Customer = {
  id: string;
  name: string;
  cpf_cnpj: string;
  email: string | null;
  whatsapp: string | null;
  address: string | null;
  trade_name: string | null;
  state_registration: string | null;
  municipal_registration: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  contact_person: string | null;
  notes: string | null;
  created_at: string;
};

export type Plan = {
  id: string;
  name: string;
  value: number;
  cycle: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  due_day: number;
  tipo_vencimento: 'DIA_FIXO' | 'DATA_CONTRATO';
  dia_vencimento: number;
  fine: number;
  interest: number;
  trial_days: number;
  informar_data_assinatura: boolean;
  created_at: string;
};

export type Subscription = {
  id: string;
  customer_id: string;
  plan_id: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  start_date: string;
  next_billing_date: string | null;
  created_at: string;
  customer?: Customer;
  plan?: Plan;
  addons?: SubscriptionAddon[];
};

export type SubscriptionAddon = {
  id: string;
  subscription_id: string;
  name: string;
  value: number;
  total_months: number;
  remaining_months: number;
  status: 'ACTIVE' | 'EXPIRED';
  created_at: string;
};

export type Charge = {
  id: string;
  customer_id: string;
  subscription_id: string | null;
  value: number;
  due_date: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  provider: 'EFI' | 'C6' | 'INTER' | 'ASAAS';
  external_id: string | null;
  txid: string | null;
  barcode: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  billet_pdf_url: string | null;
  payment_url: string | null;
  paid_at: string | null;
  payment_method: string | null;
  barcode_boleto: string | null;
  boleto_url: string | null;
  boleto_charge_id: string | null;
  boleto_linha: string | null;
  boleto_status: string | null;
  link_fatura_publica: string | null;
  valor_pago: number | null;
  data_pagamento: string | null;
  notifications_sent: string;
  charge_type: 'RECURRING' | 'ADDON' | 'SALE';
  addon_id: string | null;
  description: string | null;
  erro_boleto: string | null;
  created_at: string;
  customer?: Customer;
  subscription?: Subscription;
};

export type Settings = {
  id: number;
  billing_provider: 'EFI' | 'C6' | 'INTER' | 'ASAAS';
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  email_template: string;
  reminder_rules: string;
  issuer_name: string | null;
  issuer_trade_name: string | null;
  issuer_cnpj: string | null;
  issuer_ie: string | null;
  issuer_im: string | null;
  issuer_address: string | null;
  issuer_city: string | null;
  issuer_state: string | null;
  issuer_zip_code: string | null;
  issuer_phone: string | null;
  issuer_email: string | null;
  issuer_logo_url: string | null;
  payment_method: string | null;
  barcode_boleto: string | null;
  boleto_url: string | null;
  template_faturar: string | null;
  template_lembrete_d3: string | null;
  template_lembrete_d0: string | null;
  template_lembrete_d1: string | null;
  template_lembrete_d3_pos: string | null;
  template_lembrete_d7_pos: string | null;
  template_pago: string | null;
  created_at: string;
  updated_at: string;
};
