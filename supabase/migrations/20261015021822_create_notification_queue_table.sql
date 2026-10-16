/*
# Create notification_queue table

1. New Tables
- `notification_queue`
  - `id` (uuid, primary key)
  - `charge_id` (uuid, references charges)
  - `customer_id` (uuid, references customers)
  - `channel` (text: 'whatsapp' or 'email')
  - `message` (text, the full message body)
  - `subject` (text, nullable — for email only)
  - `file_url` (text, nullable — for whatsapp media)
  - `reminder_label` (text, nullable — e.g. 'D-3', 'CREATED', 'PAID')
  - `status` (text: 'PENDING' or 'SENT')
  - `created_at` (timestamptz)
  - `sent_at` (timestamptz, nullable)
2. Security
- Enable RLS on `notification_queue`.
- Allow anon + authenticated CRUD (single-tenant app, no auth).
3. Purpose
- When notifications fall outside business hours (night, weekend, holiday),
  they are queued here instead of being sent immediately.
- The cron job /queue-flush processes the queue during business hours.
*/

CREATE TABLE IF NOT EXISTS notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid REFERENCES charges(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  message text NOT NULL,
  subject text,
  file_url text,
  reminder_label text,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notification_queue" ON notification_queue;
CREATE POLICY "anon_select_notification_queue"
ON notification_queue FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notification_queue" ON notification_queue;
CREATE POLICY "anon_insert_notification_queue"
ON notification_queue FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notification_queue" ON notification_queue;
CREATE POLICY "anon_update_notification_queue"
ON notification_queue FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notification_queue" ON notification_queue;
CREATE POLICY "anon_delete_notification_queue"
ON notification_queue FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created ON notification_queue(created_at);
