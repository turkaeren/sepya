import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/client-info';
import { getReaderSession } from '@/lib/reader-session';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LEN = 1000;
const HOURLY_LIMIT = 8; // bir oturumun saatte bırakabileceği not sayısı

/** Okurun bir yazı için bıraktığı not. Yalnızca geçerli, isimli bir okur oturumuyla ve yayındaki yazı için kabul edilir. */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return new NextResponse(null, { status: 403 });
  const session = await getReaderSession();
  if (!session || !session.name) return new NextResponse(null, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const entryId = typeof body.entryId === 'string' && UUID.test(body.entryId) ? body.entryId : null;
  const text = typeof body.text === 'string' ? body.text.replace(/\r/g, '').trim() : '';
  if (!entryId || !text || text.length > MAX_LEN) return new NextResponse(null, { status: 400 });

  const sb = db();
  const { data: entry } = await sb.from('entries').select('id, title').eq('id', entryId).eq('published', true).maybeSingle();
  if (!entry) return new NextResponse(null, { status: 404 });

  const since = new Date(Date.now() - 3600000).toISOString();
  const { count } = await sb.from('reader_notes').select('id', { count: 'exact', head: true }).eq('session_id', session.id).gte('created_at', since);
  if ((count ?? 0) >= HOURLY_LIMIT) return new NextResponse(null, { status: 429 });

  const { error } = await sb.from('reader_notes').insert({
    entry_id: entry.id, entry_title: String(entry.title).slice(0, 200), session_id: session.id, reader_name: session.name.slice(0, 40), body: text
  });
  if (error) return new NextResponse(null, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
