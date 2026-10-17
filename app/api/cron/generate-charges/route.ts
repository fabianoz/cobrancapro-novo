export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { generateCharges } from '@/lib/recurrence';
import { flushNotificationQueue } from '@/lib/notifications';

/**
 * Cron job: runs daily at 06:00 America/Sao_Paulo
 *
 * Also flushes the notification queue (sends any messages that were
 * queued outside business hours on nights/weekends/holidays).
 *
 * Recommended schedule: every hour during business hours
 *   "crons": [
 *     { "path": "/api/cron/generate-charges", "schedule": "0 10 * * *" },
 *     { "path": "/api/cron/generate-charges?flush=1", "schedule": "0 12-21 * * 1-5" }
 *   ]
 *
 * Security: validate CRON_SECRET header to prevent unauthorized calls
 */

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const flushOnly = url.searchParams.get('flush') === '1';

  try {
    const result: Record<string, unknown> = { success: true };

    if (!flushOnly) {
      const genResult = await generateCharges();
      result.chargesCreated = genResult.created;
      result.chargesErrors = genResult.errors;
    }

    // Always attempt to flush the notification queue
    const flushResult = await flushNotificationQueue();
    result.queueSent = flushResult.sent;

    result.timestamp = new Date().toISOString();

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Cron job failed', detail: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
