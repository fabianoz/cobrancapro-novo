import { NextResponse } from 'next/server';
import { isBusinessHours, getOutsideBusinessHoursReason, isNonBusinessDay } from '@/lib/business-hours';

/**
 * Returns whether we're currently within business hours
 * and a human-readable reason if not.
 */
export async function GET() {
  const within = isBusinessHours();
  const nonBusinessDay = isNonBusinessDay();

  if (within) {
    return NextResponse.json({
      isBusinessHours: true,
      canSend: true,
      message: 'Dentro do horario comercial',
    });
  }

  return NextResponse.json({
    isBusinessHours: false,
    canSend: false,
    isNonBusinessDay,
    message: getOutsideBusinessHoursReason(),
  });
}
