import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/client-info';
import { getReaderSession } from '@/lib/reader-session';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set(['title', 'section', 'entry', 'empty', 'archive', 'menu', 'leave']);
const CATS = new Set(['siir', 'not', 'defter']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MS = 10 * 60 * 1000; // bir sayfada 10 dakikadan uzun kalış sayılmaz (sekme açık unutulmuş)

/**
 * Okuma kaydı. Her olay bir önceki sayfanın süresini kapatır; süre sunucu saatine göre hesaplanır.
 */
export async function POST(req: Request) {
  if (!(await isSameOrigin())) return new NextResponse(null, { status: 403 });
  const session = await getReaderSession();
  if (!session) return new NextResponse(null, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const kind = String(body.kind || '');
  if (!KINDS.has(kind)) return new NextResponse(null, { status: 400 });

  const sb = db();
  const now = new Date();

  // Önceki açık kaydın süresini kapat
  const { data: prev } = await sb.from('page_views').select('id, viewed_at')
    .eq('session_id', session.id).is('duration_ms', null)
    .order('viewed_at', { ascending: false }).limit(1).maybeSingle();
  if (prev) {
    const ms = Math.min(MAX_MS, Math.max(0, now.getTime() - new Date(prev.viewed_at).getTime()));
    await sb.from('page_views').update({ duration_ms: ms }).eq('id', prev.id);
  }

  if (kind !== 'leave') {
    const entryId = typeof body.entryId === 'string' && UUID.test(body.entryId) ? body.entryId : null;
    const category = typeof body.category === 'string' && CATS.has(body.category) ? body.category : null;
    const part = Number.isInteger(body.part) && (body.part as number) > 0 && (body.part as number) < 100 ? body.part : null;
    const label = typeof body.label === 'string' ? body.label.slice(0, 120) : null;
    await sb.from('page_views').insert({
      session_id: session.id, entry_id: entryId, kind, label, part, category, viewed_at: now.toISOString()
    });
  }

  await sb.from('reader_sessions').update({ last_seen_at: now.toISOString() }).eq('id', session.id);
  return new NextResponse(null, { status: 204 });
}
