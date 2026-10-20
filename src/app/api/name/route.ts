import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/client-info';
import { cleanName, getReaderSession } from '@/lib/reader-session';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await isSameOrigin())) return NextResponse.json({ ok: false }, { status: 403 });
  const session = await getReaderSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  let name: string | null = null;
  try {
    name = cleanName((await req.json())?.name);
  } catch {
    name = null;
  }
  if (!name) return NextResponse.json({ ok: false }, { status: 400 });

  const { error } = await db()
    .from('reader_sessions')
    .update({ name, last_seen_at: new Date().toISOString() })
    .eq('id', session.id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, name });
}
