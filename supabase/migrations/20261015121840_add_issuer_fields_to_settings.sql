/*
# Add issuer (emitente) fields to settings table

## Overview
Adds company/issuer data columns to the `settings` table so the user's
own company info appears on charges, boletos, reports, and notifications.

## New Columns on `settings`
1. `issuer_name` (text) — Razão social da empresa emitente
2. `issuer_trade_name` (text) — Nome fantasia
3. `issuer_cnpj` (text) — CNPJ
4. `issuer_ie` (text) — Inscrição estadual
5. `issuer_im` (text) — Inscrição municipal
6. `issuer_address` (text) — Endereço completo
7. `issuer_city` (text) — Cidade
8. `issuer_state` (text) — UF
9. `issuer_zip_code` (text) — CEP
10. `issuer_phone` (text) — Telefone
11. `issuer_email` (text) — Email
12. `issuer_logo_url` (text) — URL do logotipo

## Security
No RLS changes needed — existing policies on `settings` cover the new columns.
*/

ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_name text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_trade_name text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_cnpj text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_ie text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_im text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_address text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_city text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_state text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_zip_code text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_phone text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_email text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS issuer_logo_url text;
