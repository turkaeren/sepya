'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { clientInfo } from '@/lib/client-info';
import { hashSecret, safeEqual } from '@/lib/crypto';
import { adminLogin, adminLogout, checkTotp, hasAnyAdmin, requireAdmin, startAdminSession } from '@/lib/admin-session';
import { setReaderPin } from '@/lib/pin';

export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => (typeof f.get(k) === 'string' ? (f.get(k) as string) : '');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// —— Giriş / kurulum ————————————————————————————————————————————————

export async function loginAction(_: FormState, f: FormData): Promise<FormState> {
  const res = await adminLogin(str(f, 'email'), str(f, 'password'), str(f, 'code'), await clientInfo());
  if (!res.ok) return { error: res.error };
  redirect('/yonetim');
}

export async function logoutAction() {
  await adminLogout();
  redirect('/yonetim/giris');
}

export async function setupAction(_: FormState, f: FormData): Promise<FormState> {
  if (await hasAnyAdmin()) return { error: 'Kurulum zaten yapılmış.' };
  const expected = process.env.SETUP_TOKEN || '';
  if (expected.length < 16) return { error: 'Sunucuda SETUP_TOKEN tanımlı değil ya da 16 karakterden kısa.' };
  if (!safeEqual(str(f, 'token'), expected)) return { error: 'Kurulum anahtarı hatalı.' };

  const email = str(f, 'email').trim().toLowerCase();
  const password = str(f, 'password');
  const pin = str(f, 'pin');
  const secret = str(f, 'secret');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Geçerli bir e-posta yaz.' };
  if (password.length < 12) return { error: 'Parola en az 12 karakter olmalı.' };
  if (password !== str(f, 'password2')) return { error: 'Parolalar aynı değil.' };
  if (!/^\d{4}$/.test(pin)) return { error: 'Okur PIN’i dört rakam olmalı.' };
  if (!/^[A-Z2-7]{32}$/.test(secret)) return { error: 'Doğrulama anahtarı bozuk; sayfayı yenile.' };
  if (!checkTotp(secret, str(f, 'code').trim())) return { error: 'Doğrulama kodu tutmadı. Uygulamadaki güncel kodu yaz.' };

  const { data, error } = await db().from('admin_users')
    .insert({ email, password_hash: await hashSecret(password), totp_secret: secret })
    .select('id').single();
  if (error || !data) return { error: 'Hesap oluşturulamadı: ' + (error?.message ?? '') };
  await setReaderPin(pin);
  const info = await clientInfo();
  await db().from('admin_login_events').insert({ email, ip: info.ip, country: info.country, city: info.city, device: info.device, os: info.os, browser: info.browser, success: true, reason: 'kurulum' });
  await startAdminSession(data.id, info);
  redirect('/yonetim');
}

// —— İçerik ——————————————————————————————————————————————————————

export async function saveEntryAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const id = str(f, 'id');
  const intent = str(f, 'intent'); // publish | draft | save
  const title = str(f, 'title').trim();
  const category = str(f, 'category');
  const entry_date = str(f, 'entry_date');
  const content = str(f, 'content').replace(/\r/g, '');
  const sort_order = Number.parseInt(str(f, 'sort_order') || '0', 10) || 0;

  if (!title || title.length > 200) return { error: 'Başlık 1–200 karakter olmalı.' };
  if (!['siir', 'not', 'defter'].includes(category)) return { error: 'Kategori seç.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) return { error: 'Tarih geçersiz.' };
  if (content.length > 50000) return { error: 'Metin çok uzun.' };

  const row: Record<string, unknown> = { title, category, entry_date, content, sort_order };
  if (intent === 'publish') row.published = true;
  if (intent === 'draft') row.published = false;
  if (intent === 'save' && !id) row.published = str(f, 'published') === 'true';

  let savedId = id;
  if (id) {
    if (!UUID.test(id)) return { error: 'Geçersiz içerik.' };
    const { error } = await db().from('entries').update(row).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await db().from('entries').insert(row).select('id').single();
    if (error || !data) return { error: error?.message ?? 'Kaydedilemedi.' };
    savedId = data.id;
  }
  revalidatePath('/');
  revalidatePath('/yonetim/icerikler');
  const durum = intent === 'publish' ? 'yayinlandi' : intent === 'draft' ? 'taslak' : 'kaydedildi';
  redirect(`/yonetim/icerikler/${savedId}?durum=${durum}`);
}

export async function unpublishEntryAction(f: FormData) {
  await requireAdmin();
  const id = str(f, 'id');
  if (!UUID.test(id)) return;
  await db().from('entries').update({ published: false }).eq('id', id);
  revalidatePath('/');
  redirect(`/yonetim/icerikler/${id}?durum=kaldirildi`);
}

export async function deleteEntryAction(f: FormData) {
  await requireAdmin();
  const id = str(f, 'id');
  if (!UUID.test(id) || str(f, 'confirm') !== 'sil') redirect(`/yonetim/icerikler/${id}?durum=silinmedi`);
  await db().from('entries').delete().eq('id', id);
  revalidatePath('/');
  redirect('/yonetim/icerikler?durum=silindi');
}

// —— Oturumlar ve güvenlik ————————————————————————————————————————

export async function revokeSessionAction(f: FormData) {
  await requireAdmin();
  const id = str(f, 'id');
  if (!UUID.test(id)) return;
  await db().from('reader_sessions').update({ ended_at: new Date().toISOString(), end_reason: 'revoked' }).eq('id', id).is('ended_at', null);
  revalidatePath('/yonetim', 'layout');
}

export async function revokeAllAction() {
  await requireAdmin();
  await db().from('reader_sessions').update({ ended_at: new Date().toISOString(), end_reason: 'revoked' }).is('ended_at', null);
  revalidatePath('/yonetim', 'layout');
}

export async function endAdminSessionAction(f: FormData) {
  const me = await requireAdmin();
  const id = str(f, 'id');
  if (!UUID.test(id) || id === me.sessionId) return;
  await db().from('admin_sessions').update({ ended_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/yonetim/guvenlik');
}

export async function blockIpAction(f: FormData) {
  await requireAdmin();
  const ip = str(f, 'ip');
  const hours = Math.min(24 * 365, Math.max(1, Number.parseInt(str(f, 'hours') || '24', 10) || 24));
  if (!/^[0-9a-f.:]{3,45}$/i.test(ip)) return;
  await db().from('ip_blocks').upsert({ ip, until: new Date(Date.now() + hours * 3600000).toISOString(), reason: 'yönetici tarafından', created_at: new Date().toISOString() });
  revalidatePath('/yonetim', 'layout');
}

export async function unblockIpAction(f: FormData) {
  await requireAdmin();
  const ip = str(f, 'ip');
  if (!/^[0-9a-f.:]{3,45}$/i.test(ip)) return;
  await db().from('ip_blocks').delete().eq('ip', ip);
  revalidatePath('/yonetim', 'layout');
}

export async function changePinAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const pin = str(f, 'pin');
  if (!/^\d{4}$/.test(pin)) return { error: 'PIN dört rakam olmalı.' };
  if (pin !== str(f, 'pin2')) return { error: 'İki PIN aynı değil.' };
  await setReaderPin(pin);
  await db().from('reader_sessions').update({ ended_at: new Date().toISOString(), end_reason: 'pin_changed' }).is('ended_at', null);
  revalidatePath('/yonetim', 'layout');
  return { ok: 'PIN değişti. Açık okur oturumları kapatıldı.' };
}
