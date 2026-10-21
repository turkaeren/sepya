import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { randomToken, sha256 } from './crypto';
import type { ClientInfo } from './client-info';

export const READER_COOKIE = 'sepya_s';
export const VISITOR_COOKIE = 'sepya_v';
export const SESSION_HOURS = 12;
export const IDLE_MINUTES = 30;

const secure = process.env.NODE_ENV === 'production';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ReaderSession {
  id: string;
  name: string | null;
  visitorId: string;
}

export async function getReaderSession(): Promise<ReaderSession | null> {
  const jar = await cookies();
  const token = jar.get(READER_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const { data } = await db()
    .from('reader_sessions')
    .select('id, name, visitor_id, expires_at, last_seen_at, ended_at')
    .eq('token_hash', sha256(token))
    .maybeSingle();
  if (!data || data.ended_at) return null;
  const now = Date.now();
  if (new Date(data.expires_at).getTime() < now) return null;
  if (new Date(data.last_seen_at).getTime() < now - IDLE_MINUTES * 60000) return null;
  return { id: data.id, name: data.name, visitorId: data.visitor_id };
}

export async function touchSession(id: string) {
  await db().from('reader_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', id);
}

export async function createReaderSession(info: ClientInfo, name: string | null = null, src: { source: string; ref: string | null } | null = null) {
  const jar = await cookies();
  const token = randomToken();
  const existingVisitor = jar.get(VISITOR_COOKIE)?.value;
  const visitorId = existingVisitor && UUID.test(existingVisitor) ? existingVisitor : randomUUID();
  const expires = new Date(Date.now() + SESSION_HOURS * 3600000);

  const { error } = await db().from('reader_sessions').insert({
    token_hash: sha256(token),
    visitor_id: visitorId,
    name,
    ip: info.ip,
    country: info.country,
    city: info.city,
    device: info.device,
    os: info.os,
    browser: info.browser,
    user_agent: info.userAgent,
    referer: info.referer,
    source: src?.source ?? null,
    source_ref: src?.ref ?? null,
    expires_at: expires.toISOString()
  });
  if (error) throw new Error(error.message);

  jar.set(READER_COOKIE, token, { httpOnly: true, secure, sameSite: 'strict', path: '/', expires });
  // Tekrar gelen okuru tanımak için: rastgele kimlik, kişisel veri yok
  jar.set(VISITOR_COOKIE, visitorId, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
}

/** Aynı tarayıcının son kullandığı isim (isim ekranında önerilir). */
export async function lastNameForVisitor(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(VISITOR_COOKIE)?.value;
  if (!v || !UUID.test(v)) return null;
  const { data } = await db()
    .from('reader_sessions')
    .select('name')
    .eq('visitor_id', v)
    .not('name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.name ?? null;
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const n = raw.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  if (!n || n.length > 40) return null;
  return n;
}
