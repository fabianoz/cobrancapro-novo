/*
# Add extra fields to customers table

## Overview
Adds new columns to the `customers` table to store additional company/contact
information that is useful for billing and CNPJ consultation (Sintegra).

## New Columns on `customers`
1. `trade_name` (text) — Nome fantasia da empresa
2. `state_registration` (text) — Inscricao estadual (IE)
3. `municipal_registration` (text) — Inscricao municipal (IM)
4. `zip_code` (text) — CEP
5. `city` (text) — Cidade
6. `state` (text) — UF (estado)
7. `neighborhood` (text) — Bairro
8. `street` (text) — Logradouro
9. `street_number` (text) — Numero
10. `complement` (text) — Complemento
11. `contact_person` (text) — Pessoa de contato (responsavel)
12. `notes` (text) — Observacoes gerais

## Security
No changes to RLS policies — existing `TO anon, authenticated` policies on
`customers` already cover the new columns since they apply to the whole table.

## Notes
- All new columns are nullable so existing rows remain valid.
- No data is lost; existing columns are untouched.
*/

ALTER TABLE customers ADD COLUMN IF NOT EXISTS trade_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state_registration text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS municipal_registration text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS zip_code text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS street_number text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS complement text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes text;
