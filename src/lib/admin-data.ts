import 'server-only';
import { db, must } from './db';
import { istDay } from './format';

export interface Daily { d: string; sessions: number; visitors: number; new: number; views: number; ok: number; fail: number }
export interface KN { k: string; n: number }
export interface Analytics {
  daily: Daily[];
  devices: KN[];
  browsers: KN[];
  countries: KN[];
  categories: KN[];
  hours: number[];
  top: { id: string; title: string; n: number; avg: number | null }[];
  totals: { sessions_all: number; visitors_all: number; sessions: number; visitors: number; views: number; returning: number };
}

export async function getAnalytics(days: number): Promise<Analytics> {
  const data = must(await db().rpc('admin_analytics', { p_days: days }));
  return data as Analytics;
}

/** "2026-10-21" → "21" (ayın ilk günü ya da ilk sütunsa "1 Eki") */
export function dayTick(d: string, i: number) {
  const [, m, day] = d.split('-').map(Number);
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return i === 0 || day === 1 ? `${day} ${months[m - 1]}` : String(day);
}

export const today = () => istDay(new Date());

export async function failAlert() {
  const since = new Date(Date.now() - 15 * 60000).toISOString();
  const { data } = await db().from('pin_attempts').select('ip').eq('outcome', 'fail').gte('attempted_at', since).limit(500);
  const rows = data ?? [];
  if (rows.length < 5) return null;
  const byIp = new Map<string, number>();
  for (const r of rows) if (r.ip) byIp.set(r.ip, (byIp.get(r.ip) ?? 0) + 1);
  const top = [...byIp.entries()].sort((a, b) => b[1] - a[1])[0];
  let blockedUntil: string | null = null;
  if (top) {
    const { data: b } = await db().from('ip_blocks').select('until').eq('ip', top[0]).maybeSingle();
    if (b && new Date(b.until).getTime() > Date.now()) blockedUntil = b.until;
  }
  return { count: rows.length, ip: top?.[0] ?? null, ipCount: top?.[1] ?? 0, blockedUntil };
}

export async function countSince(table: 'reader_sessions' | 'pin_attempts', col: string, sinceIso: string, extra?: (q: any) => any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db().from(table).select('id', { count: 'exact', head: true }).gte(col, sinceIso);
  if (extra) q = extra(q);
  const { count } = await q;
  return count ?? 0;
}

export function istMidnightIso(daysAgo = 0) {
  // İstanbul UTC+3 (yaz saati yok): yerel gece yarısı = 21:00 UTC önceki gün
  const d = istDay(new Date(Date.now() - daysAgo * 86400000));
  return new Date(`${d}T00:00:00+03:00`).toISOString();
}

/** Okurların nereden geldiği: oturum ve başarısız deneme sayısı, kaynağa göre. */
export async function getSources(days: number) {
  const since = istMidnightIso(days - 1);
  const sb = db();
  const [{ data: ses }, { data: att }] = await Promise.all([
    sb.from('reader_sessions').select('source').not('name', 'is', null).gte('created_at', since).limit(10000),
    sb.from('pin_attempts').select('source').eq('outcome', 'fail').not('source', 'is', null).gte('attempted_at', since).limit(10000)
  ]);
  const group = (rows: { source: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.source) m.set(r.source, (m.get(r.source) ?? 0) + 1);
    return [...m.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n).slice(0, 12);
  };
  return {
    sessions: group(ses),
    attempts: group(att),
    total: (ses ?? []).length,
    unknown: (ses ?? []).filter((r) => !r.source).length
  };
}
