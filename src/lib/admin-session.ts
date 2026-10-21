import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as OTPAuth from 'otpauth';
import { db } from './db';
import { hashSecret, randomToken, sha256, verifySecret } from './crypto';
import type { ClientInfo } from './client-info';

export const ADMIN_COOKIE = 'sepya_a';
const ABS_HOURS = 8;
const IDLE_MINUTES = 120;
const REMEMBER_DAYS = 30; // "bu cihazda açık kalsın": uygulama her açılışta giriş istemesin
export const ADMIN_RULES = { maxFails: 5, windowMin: 15, accountMaxFails: 10, accountWindowMin: 60 };
const secure = process.env.NODE_ENV === 'production';

export interface Admin { sessionId: string; adminId: string; email: string }

export async function getAdmin(): Promise<Admin | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const { data } = await db()
    .from('admin_sessions')
    .select('id, admin_id, created_at, expires_at, last_seen_at, ended_at, admin_users(email)')
    .eq('token_hash', sha256(token))
    .maybeSingle();
  if (!data || data.ended_at) return null;
  const now = Date.now();
  if (new Date(data.expires_at).getTime() < now) return null;
  const remembered = new Date(data.expires_at).getTime() - new Date(data.created_at).getTime() > 86400000;
  const idleMs = remembered ? REMEMBER_DAYS * 86400000 : IDLE_MINUTES * 60000;
  if (new Date(data.last_seen_at).getTime() < now - idleMs) return null;
  if (now - new Date(data.last_seen_at).getTime() > 60000) {
    await db().from('admin_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id);
  }
  const u = data.admin_users as unknown as { email: string } | null;
  return { sessionId: data.id, adminId: data.admin_id, email: u?.email ?? '' };
}

export async function requireAdmin(): Promise<Admin> {
  const a = await getAdmin();
  if (!a) redirect('/yonetim/giris');
  return a;
}

export async function hasAnyAdmin() {
  const { count } = await db().from('admin_users').select('id', { count: 'exact', head: true });
  return (count ?? 0) > 0;
}

export function newTotpSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function totpUri(secret: string, email: string) {
  return new OTPAuth.TOTP({ issuer: 'SEPYA', label: email || 'yonetici', secret: OTPAuth.Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6, period: 30 }).toString();
}

export function checkTotp(secret: string, code: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6, period: 30 });
  return totp.validate({ token: code, window: 1 }) !== null;
}

async function logEvent(info: ClientInfo, email: string, success: boolean, reason: string) {
  await db().from('admin_login_events').insert({
    email: email.slice(0, 200), ip: info.ip, country: info.country, city: info.city, device: info.device,
    os: info.os, browser: info.browser, success, reason
  });
}

export async function startAdminSession(adminId: string, info: ClientInfo, remember = false) {
  const token = randomToken();
  const expires = new Date(Date.now() + (remember ? REMEMBER_DAYS * 86400000 : ABS_HOURS * 3600000));
  const { error } = await db().from('admin_sessions').insert({
    token_hash: sha256(token), admin_id: adminId, ip: info.ip, device: info.device, os: info.os, browser: info.browser,
    expires_at: expires.toISOString()
  });
  if (error) throw new Error(error.message);
  (await cookies()).set(ADMIN_COOKIE, token, { httpOnly: true, secure, sameSite: 'strict', path: '/', expires });
}

// Kullanıcı yokken de aynı sürede yanıt vermek için sabit bir hash
let dummyHash: Promise<string> | null = null;

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Yönetici girişi: e-posta + parola. (İki adımlı doğrulama kullanıcının isteğiyle kapalı.) */
export async function adminLogin(emailRaw: string, password: string, info: ClientInfo, remember = false): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const sb = db();

  if (info.ip) {
    const since = new Date(Date.now() - ADMIN_RULES.windowMin * 60000).toISOString();
    const { count } = await sb.from('admin_login_events').select('id', { count: 'exact', head: true })
      .eq('ip', info.ip).eq('success', false).gte('at', since);
    if ((count ?? 0) >= ADMIN_RULES.maxFails) {
      await logEvent(info, email, false, 'kilit');
      return { ok: false, error: 'Çok fazla hatalı deneme. 15 dakika sonra yeniden dene.' };
    }
  }

  // Hesap bazlı kilit: farklı IP'lerden gelen denemeleri de sayar
  if (email) {
    const since = new Date(Date.now() - ADMIN_RULES.accountWindowMin * 60000).toISOString();
    const { count } = await sb.from('admin_login_events').select('id', { count: 'exact', head: true })
      .eq('email', email).eq('success', false).gte('at', since);
    if ((count ?? 0) >= ADMIN_RULES.accountMaxFails) {
      await logEvent(info, email, false, 'hesap kilitli');
      return { ok: false, error: 'Bu hesap çok fazla hatalı deneme yüzünden bir saatliğine kilitlendi.' };
    }
  }

  const { data: user } = await sb.from('admin_users').select('id, password_hash').eq('email', email).maybeSingle();
  dummyHash = dummyHash || hashSecret('sepya-yok-boyle-biri');
  const passOk = await verifySecret(user?.password_hash ?? (await dummyHash), password);
  if (!user || !passOk) {
    await logEvent(info, email, false, 'parola');
    return { ok: false, error: 'E-posta ya da parola hatalı.' };
  }
  await logEvent(info, email, true, remember ? 'giriş · hatırla' : 'giriş');
  await startAdminSession(user.id, info, remember);
  return { ok: true };
}

export async function adminLogout() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await db().from('admin_sessions').update({ ended_at: new Date().toISOString() }).eq('token_hash', sha256(token));
  jar.delete(ADMIN_COOKIE);
}
