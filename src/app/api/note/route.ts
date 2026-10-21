import { NextResponse } from 'next/server';
import { clientInfo, isSameOrigin } from '@/lib/client-info';
import { getReaderSession, touchSession } from '@/lib/reader-session';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITS = { perHour: 6, perDay: 20 };

/** Okurun yazara notu. Yalnızca geçerli okur oturumuyla; saatte 6, günde 20 not. */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return new NextResponse(null, { status: 403 });
  const session = await getReaderSession();
  if (!session) return new NextResponse(null, { status: 401 });

  let raw: Record<string, unknown> = {};
  try { raw = await req.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const body = typeof raw.body === 'string' ? raw.body.replace(/\r/g, '').trim() : '';
  if (!body || body.length > 2000) return new NextResponse(null, { status: 400 });
  const entryId = typeof raw.entryId === 'string' && UUID.test(raw.entryId) ? raw.entryId : null;

  const sb = db();
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const [{ count: h }, { count: d }] = await Promise.all([
    sb.from('reader_notes').select('id', { count: 'exact', head: true }).eq('visitor_id', session.visitorId).gte('created_at', hourAgo),
    sb.from('reader_notes').select('id', { count: 'exact', head: true }).eq('visitor_id', session.visitorId).gte('created_at', dayAgo)
  ]);
  if ((h ?? 0) >= LIMITS.perHour || (d ?? 0) >= LIMITS.perDay) return new NextResponse(null, { status: 429 });

  let entryTitle: string | null = null;
  if (entryId) {
    const { data } = await sb.from('entries').select('title, published').eq('id', entryId).maybeSingle();
    if (data?.published) entryTitle = data.title;
  }

  const info = await clientInfo();
  const { error } = await sb.from('reader_notes').insert({
    session_id: session.id, visitor_id: session.visitorId, name: session.name,
    entry_id: entryTitle ? entryId : null, entry_title: entryTitle, body, ip: info.ip
  });
  if (error) return new NextResponse(null, { status: 500 });
  await touchSession(session.id);
  return NextResponse.json({ ok: true });
}
