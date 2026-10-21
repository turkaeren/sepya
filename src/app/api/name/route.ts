import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/client-info';
import { getReaderSession } from '@/lib/reader-session';
import { checkName } from '@/lib/name';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await isSameOrigin())) return NextResponse.json({ ok: false }, { status: 403 });
  const session = await getReaderSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  let raw: unknown = null;
  try { raw = (await req.json())?.name; } catch { raw = null; }
  const nc = checkName(raw);
  if (!nc.ok) return NextResponse.json({ ok: false, reason: nc.reason }, { status: 400 });
  const name = nc.name;

  const { error } = await db()
    .from('reader_sessions')
    .update({ name, last_seen_at: new Date().toISOString() })
    .eq('id', session.id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, name });
}
