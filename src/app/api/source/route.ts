import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isSameOrigin } from '@/lib/client-info';
import { getReaderSession } from '@/lib/reader-session';
import { detectSource } from '@/lib/source';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Oturumu açık okur siteye bir bağlantıyla yeniden geldiğinde (Instagram, ?kaynak=… vb.)
 * oturumun kaynağını günceller. Belirsiz gelişler ("Doğrudan") var olan kaynağı ezmez.
 */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return new NextResponse(null, { status: 403 });
  const session = await getReaderSession();
  if (!session) return new NextResponse(null, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const ref = typeof body.ref === 'string' ? body.ref.slice(0, 500) : '';
  const qs = typeof body.qs === 'string' ? body.qs.slice(0, 500) : '';
  const h = await headers();
  const src = detectSource(ref, qs, h.get('user-agent') ?? '', h.get('x-forwarded-host') || h.get('host'));
  if (src.source === 'Doğrudan') return NextResponse.json({ source: null });
  await db().from('reader_sessions').update({ source: src.source, source_ref: src.ref }).eq('id', session.id);
  return NextResponse.json({ source: src.source });
}
