import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/admin-session';
import { getReaderSession } from '@/lib/reader-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * Kapak görseli. Depolama alanı özeldir; görsel yalnızca geçerli bir okur ya da yönetici oturumuyla,
 * sunucu üzerinden verilir. Okurlar yalnızca yayındaki yazıların görselini görür.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });

  const admin = await getAdmin();
  const reader = admin ? null : await getReaderSession();
  if (!admin && !reader) return new NextResponse(null, { status: 401 });

  const { data } = await db().from('entries').select('cover_url, published').eq('id', id).maybeSingle();
  if (!data || !data.cover_url || (!admin && !data.published)) return new NextResponse(null, { status: 404 });

  const path = String(data.cover_url);
  const { data: file, error } = await db().storage.from('covers').download(path);
  if (error || !file) return new NextResponse(null, { status: 404 });

  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return new NextResponse(file, {
    status: 200,
    headers: {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': 'private, max-age=86400',
      'x-robots-tag': 'noindex, nofollow, noarchive'
    }
  });
}
