import { NextResponse } from 'next/server';
import { clientInfo, isSameOrigin } from '@/lib/client-info';
import { attemptPin } from '@/lib/pin';
import { createReaderSession } from '@/lib/reader-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await isSameOrigin())) return NextResponse.json({ state: 'error' }, { status: 403 });

  let pin = '';
  try {
    const body = await req.json();
    pin = typeof body?.pin === 'string' ? body.pin : '';
  } catch {
    return NextResponse.json({ state: 'error' }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) return NextResponse.json({ state: 'error' }, { status: 400 });

  const info = await clientInfo();
  const result = await attemptPin(pin, info);
  pin = ''; // değer bu noktadan sonra hiçbir yerde kullanılmaz

  if (result.state === 'ok') {
    await createReaderSession(info);
    return NextResponse.json({ state: 'ok' });
  }
  if (result.state === 'unset') {
    return NextResponse.json({ state: 'unset' }, { status: 503 });
  }
  const status = result.state === 'fail' ? 401 : 429;
  const res = NextResponse.json(result, { status });
  if ('retryAfter' in result) res.headers.set('Retry-After', String(result.retryAfter));
  return res;
}
