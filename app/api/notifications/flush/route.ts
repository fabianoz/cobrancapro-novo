export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { flushNotificationQueue } from '@/lib/notifications';
import { isBusinessHours, getOutsideBusinessHoursReason } from '@/lib/business-hours';

/**
 * Manually flush the notification queue.
 * Only processes during business hours; otherwise returns the reason.
 */
export async function POST() {
  if (!isBusinessHours()) {
    const reason = getOutsideBusinessHoursReason();
    return NextResponse.json({
      success: false,
      reason,
      sent: 0,
    });
  }

  try {
    const result = await flushNotificationQueue();
    return NextResponse.json({ success: true, sent: result.sent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
