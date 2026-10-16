/*
# CobrancaPro - Complete Database Schema

## Overview
Creates the full database schema for CobrancaPro, a recurring billing SaaS.
This is a single-tenant app (no auth/login screen), so all policies use
TO anon, authenticated with USING (true) since the data is intentionally shared.

## New Tables
1. `customers` - Customer records with name, CPF/CNPJ, email, WhatsApp, address
2. `plans` - Billing plans with value, cycle (WEEKLY/MONTHLY/YEARLY), due day, fine, interest, trial days
3. `subscriptions` - Links customers to plans with status (ACTIVE/PAUSED/CANCELLED) and next billing date
4. `charges` - Individual charge records with payment provider data (EFI/C6), PIX, boleto info
5. `settings` - Single-row app configuration (provider selection, API credentials, reminder rules)

## Security
- RLS enabled on all tables
- All policies use TO anon, authenticated with USING (true) — single-tenant, no auth screen
- Data is intentionally shared/public within the app
*/

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf_cnpj text NOT NULL,
  email text,
  whatsapp text,
  address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE TO anon, authenticated USING (true);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value decimal(10,2) NOT NULL,
  cycle text NOT NULL DEFAULT 'MONTHLY',
  due_day int NOT NULL DEFAULT 10 CHECK (due_day >= 1 AND due_day <= 28),
  fine decimal(5,2) DEFAULT 0,
  interest decimal(5,2) DEFAULT 0,
  trial_days int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_plans" ON plans;
CREATE POLICY "anon_select_plans" ON plans FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_plans" ON plans;
CREATE POLICY "anon_insert_plans" ON plans FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_plans" ON plans;
CREATE POLICY "anon_update_plans" ON plans FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_plans" ON plans;
CREATE POLICY "anon_delete_plans" ON plans FOR DELETE TO anon, authenticated USING (true);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ACTIVE',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_subscriptions" ON subscriptions;
CREATE POLICY "anon_select_subscriptions" ON subscriptions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_subscriptions" ON subscriptions;
CREATE POLICY "anon_insert_subscriptions" ON subscriptions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_subscriptions" ON subscriptions;
CREATE POLICY "anon_update_subscriptions" ON subscriptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_subscriptions" ON subscriptions;
CREATE POLICY "anon_delete_subscriptions" ON subscriptions FOR DELETE TO anon, authenticated USING (true);

-- Charges table
CREATE TABLE IF NOT EXISTS charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  value decimal(10,2) NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  provider text DEFAULT 'EFI',
  external_id text,
  barcode text,
  pix_qr_code text,
  pix_copy_paste text,
  billet_pdf_url text,
  payment_url text,
  paid_at timestamptz,
  notifications_sent text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_charges" ON charges;
CREATE POLICY "anon_select_charges" ON charges FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_charges" ON charges;
CREATE POLICY "anon_insert_charges" ON charges FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_charges" ON charges;
CREATE POLICY "anon_update_charges" ON charges FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_charges" ON charges;
CREATE POLICY "anon_delete_charges" ON charges FOR DELETE TO anon, authenticated USING (true);

-- Settings table (single-row config)
CREATE TABLE IF NOT EXISTS settings (
  id int PRIMARY KEY DEFAULT 1,
  billing_provider text DEFAULT 'EFI',
  evolution_api_url text,
  evolution_api_key text,
  evolution_instance_name text DEFAULT 'cobrancapro',
  email_template text DEFAULT 'Olá {{name}}, sua cobrança de R$ {{value}} vence em {{dueDate}}. Pague via PIX copia e cola ou boleto: {{paymentUrl}}',
  reminder_rules text DEFAULT 'D-3,D-0,D+1,D+3,D+7',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT settings_single_row CHECK (id = 1)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_charges_customer_id ON charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status);
CREATE INDEX IF NOT EXISTS idx_charges_due_date ON charges(due_date);
CREATE INDEX IF NOT EXISTS idx_charges_subscription_id ON charges(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date);
