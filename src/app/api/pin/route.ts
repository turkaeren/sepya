import { NextResponse } from 'next/server';
import { clientInfo, isSameOrigin } from '@/lib/client-info';
import { attemptPin } from '@/lib/pin';
import { createReaderSession } from '@/lib/reader-session';
import { checkName } from '@/lib/name';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Önce isim, sonra şifre: deneme isimle birlikte kaydedilir; şifrenin kendisi hiçbir yere yazılmaz. */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return NextResponse.json({ state: 'error' }, { status: 403 });

  let pin = '';
  let rawName: unknown = null;
  try {
    const body = await req.json();
    pin = typeof body?.pin === 'string' ? body.pin : '';
    rawName = body?.name;
  } catch {
    return NextResponse.json({ state: 'error' }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) return NextResponse.json({ state: 'error' }, { status: 400 });

  const nc = checkName(rawName);
  if (!nc.ok) return NextResponse.json({ state: 'badname', reason: nc.reason }, { status: 400 });

  const info = await clientInfo();
  const result = await attemptPin(pin, info, nc.name);
  pin = '';

  if (result.state === 'ok') {
    await createReaderSession(info, nc.name);
    return NextResponse.json({ state: 'ok', name: nc.name });
  }
  if (result.state === 'unset') return NextResponse.json({ state: 'unset' }, { status: 503 });
  const res = NextResponse.json(result, { status: result.state === 'fail' ? 401 : 429 });
  if ('retryAfter' in result) res.headers.set('Retry-After', String(result.retryAfter));
  return res;
}
