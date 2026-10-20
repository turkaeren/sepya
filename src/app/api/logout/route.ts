import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isSameOrigin } from '@/lib/client-info';
import { READER_COOKIE } from '@/lib/reader-session';
import { sha256 } from '@/lib/crypto';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Okur "kilitle"ye bastığında oturumu kapatır. */
export async function POST() {
  if (!(await isSameOrigin())) return new NextResponse(null, { status: 403 });
  const jar = await cookies();
  const token = jar.get(READER_COOKIE)?.value;
  if (token && token.length <= 100) {
    await db().from('reader_sessions')
      .update({ ended_at: new Date().toISOString(), end_reason: 'logout' })
      .eq('token_hash', sha256(token)).is('ended_at', null);
  }
  jar.delete(READER_COOKIE);
  return new NextResponse(null, { status: 204 });
}
