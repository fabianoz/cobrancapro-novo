/*
# EFI - Store certificate in DB as base64

1. Settings table:
- Add efi_certificate_base64 (text) — stores the .p12 file content as base64
- efi_certificate_password left in place but no longer used (cert has no password)
*/

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS efi_certificate_base64 text;
