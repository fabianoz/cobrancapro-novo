/*
# Add SMTP email configuration columns to settings table

1. Modified Tables
- `settings`: adds 6 new columns for SMTP email configuration
  - `smtp_host` (text) — SMTP server hostname (e.g. smtp.hostinger.com)
  - `smtp_port` (int) — SMTP port (587, 465, 25)
  - `smtp_user` (text) — SMTP username/email
  - `smtp_password` (text) — SMTP password
  - `smtp_secure` (boolean) — true for TLS/465, false for STARTTLS/587
  - `smtp_from_email` (text) — From email address

2. Security
- No new tables. Existing RLS policies on settings remain unchanged.
- This is a single-tenant app (no auth) so anon+authenticated policies already cover access.
*/

ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_host text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_port int DEFAULT 587;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_user text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_password text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_secure boolean DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS smtp_from_email text;
