/*
# Add subscription addons and standalone sales support

## Overview
Adds two new features:
1. **Servico adicional por X meses** — an addon service that is charged
   together with the monthly subscription for a limited number of months.
2. **Venda avulsa** — a standalone one-time sale, not tied to any
   subscription.

## New Tables
### `subscription_addons`
Tracks addon services attached to a subscription. Each addon has a name,
a value that is added to the monthly charge, and a duration in months.
The `remaining_months` column is decremented each time a charge is
generated that includes the addon. When it reaches 0, the addon is
marked as expired.

- `id` (uuid, primary key)
- `subscription_id` (uuid, FK to subscriptions, CASCADE on delete)
- `name` (text, name of the addon service)
- `value` (decimal(10,2), amount added to each charge)
- `total_months` (int, how many months the addon lasts)
- `remaining_months` (int, decremented each billing cycle)
- `status` (text, ACTIVE / EXPIRED)
- `created_at` (timestamptz)

## Modified Tables
### `charges`
- `charge_type` (text, default 'RECURRING') — 'RECURRING', 'ADDON', or 'SALE'
- `addon_id` (uuid, nullable, FK to subscription_addons) — set when the
  charge includes an addon
- `description` (text) — description for standalone sales or addon charges

## Security
- RLS enabled on `subscription_addons` with anon+authenticated CRUD
  (single-tenant, no auth screen — same as all other tables).
- No RLS changes needed on `charges` — existing policies cover new columns.

## Notes
- All new columns are nullable/defaulted so existing rows remain valid.
- The recurrence engine will sum addon values when generating charges
  and decrement `remaining_months` each cycle.
*/

CREATE TABLE IF NOT EXISTS subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  name text NOT NULL,
  value decimal(10,2) NOT NULL DEFAULT 0,
  total_months int NOT NULL DEFAULT 1,
  remaining_months int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sub_addons" ON subscription_addons;
CREATE POLICY "anon_select_sub_addons" ON subscription_addons FOR SELECT
TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sub_addons" ON subscription_addons;
CREATE POLICY "anon_insert_sub_addons" ON subscription_addons FOR INSERT
TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sub_addons" ON subscription_addons;
CREATE POLICY "anon_update_sub_addons" ON subscription_addons FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sub_addons" ON subscription_addons;
CREATE POLICY "anon_delete_sub_addons" ON subscription_addons FOR DELETE
TO anon, authenticated USING (true);

ALTER TABLE charges ADD COLUMN IF NOT EXISTS charge_type text DEFAULT 'RECURRING';
ALTER TABLE charges ADD COLUMN IF NOT EXISTS addon_id uuid REFERENCES subscription_addons(id) ON DELETE SET NULL;
ALTER TABLE charges ADD COLUMN IF NOT EXISTS description text;

CREATE INDEX IF NOT EXISTS idx_sub_addons_sub_id ON subscription_addons(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_addons_status ON subscription_addons(status);
CREATE INDEX IF NOT EXISTS idx_charges_type ON charges(charge_type);
