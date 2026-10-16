/*
# Add erro_boleto column to charges table

1. Modified Tables
- `charges`: Added `erro_boleto` (text, nullable) to store detailed Efí API error when boleto generation fails.
  This error is surfaced on the public invoice page so the operator can see exactly why the boleto didn't generate.
2. Security
- No RLS changes. Existing policies remain unchanged.
*/

ALTER TABLE charges
ADD COLUMN IF NOT EXISTS erro_boleto text;
