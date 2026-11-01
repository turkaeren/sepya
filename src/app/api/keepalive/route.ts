import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron her gün çağırır. Supabase'in ücretsiz planı 7 gün etkinlik görmeyen projeyi durdurur;
 * bu küçük sorgu projeyi etkin tutar. Hiçbir veri döndürmez.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  const { error } = await db().from('settings').select('key', { count: 'exact', head: true });
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
