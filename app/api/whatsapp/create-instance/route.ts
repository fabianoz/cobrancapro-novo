export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { createInstance } from '@/lib/whatsapp';

export async function POST() {
  try {
    const result = await createInstance();
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
