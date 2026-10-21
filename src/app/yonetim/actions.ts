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
  const res = await adminLogin(str(f, 'email'), str(f, 'password'), await clientInfo(), str(f, 'remember') === '1');
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

const COVER_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const COVER_MAX = 3 * 1024 * 1024; // depolama alanındaki sınırla aynı

export async function saveEntryAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const id = str(f, 'id');
  const intent = str(f, 'intent'); // publish | draft
  const title = str(f, 'title').trim();
  const category = str(f, 'category');
  const entry_date = str(f, 'entry_date');
  const content = str(f, 'content').replace(/\r/g, '');
  const sort_order = Number.parseInt(str(f, 'sort_order') || '0', 10) || 0;
  const removeCover = str(f, 'cover_remove') === '1';
  const initials = str(f, 'initials').replace(/\s+/g, ' ').trim();
  const initials_style = str(f, 'initials_style') || 'el';
  const rawCover = f.get('cover');
  const cover = rawCover instanceof File && rawCover.size > 0 ? rawCover : null;

  if (!title || title.length > 200) return { error: 'Başlık 1–200 karakter olmalı.' };
  if (!['siir', 'not', 'defter'].includes(category)) return { error: 'Kategori seç.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) return { error: 'Tarih geçersiz.' };
  if (content.length > 50000) return { error: 'Metin çok uzun.' };
  if (initials.length > 12) return { error: 'Baş harf en fazla 12 karakter olabilir.' };
  if (!['el', 'daktilo', 'gotik'].includes(initials_style)) return { error: 'Baş harf yazı tipi geçersiz.' };
  if (intent !== 'publish' && intent !== 'draft') return { error: 'Önce “Taslak” ya da “Yayınla” düğmesine bas.' };
  if (cover && !COVER_TYPES[cover.type]) return { error: 'Görsel JPEG, PNG ya da WebP olmalı.' };
  if (cover && cover.size > COVER_MAX) return { error: 'Görsel 3 MB’tan büyük olamaz.' };
  if (id && !UUID.test(id)) return { error: 'Geçersiz içerik.' };

  const row: Record<string, unknown> = { title, category, entry_date, content, sort_order, published: intent === 'publish', initials: initials || null, initials_style };

  let savedId = id;
  let oldCover: string | null = null;
  if (id) {
    const { data: cur } = await db().from('entries').select('cover_url').eq('id', id).maybeSingle();
    oldCover = (cur?.cover_url as string | null) ?? null;
    const { error } = await db().from('entries').update(row).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await db().from('entries').insert(row).select('id').single();
    if (error || !data) return { error: error?.message ?? 'Kaydedilemedi.' };
    savedId = data.id;
  }

  // Kapak görseli: yeni dosya varsa yükle, yoksa istenirse kaldır.
  let coverFail = '';
  if (cover) {
    const path = `${savedId}/${Date.now()}.${COVER_TYPES[cover.type]}`;
    const up = await db().storage.from('covers').upload(path, Buffer.from(await cover.arrayBuffer()), { contentType: cover.type, upsert: false });
    if (up.error) {
      coverFail = up.error.message;
    } else {
      const { error } = await db().from('entries').update({ cover_url: path }).eq('id', savedId);
      if (error) coverFail = error.message;
      else if (oldCover) await db().storage.from('covers').remove([oldCover]);
    }
  } else if (removeCover && oldCover) {
    await db().from('entries').update({ cover_url: null }).eq('id', savedId);
    await db().storage.from('covers').remove([oldCover]);
  }

  revalidatePath('/');
  revalidatePath('/yonetim/icerikler');
  if (coverFail) redirect(`/yonetim/icerikler/${savedId}?durum=gorselhata`);
  const durum = intent === 'publish' ? 'yayinlandi' : 'taslak';
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
  const { data: files } = await db().storage.from('covers').list(id);
  if (files?.length) await db().storage.from('covers').remove(files.map((o) => `${id}/${o.name}`));
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

// —— Okur notları ——————————————————————————————————————————————————

export async function deleteNoteAction(f: FormData) {
  await requireAdmin();
  const id = str(f, 'id');
  if (!UUID.test(id)) return;
  await db().from('reader_notes').delete().eq('id', id);
  revalidatePath('/yonetim/notlar');
}

// —— Kapak yazıları ————————————————————————————————————————————————

export async function saveCoverAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const { COVER_DEFAULT, COVER_LIMITS } = await import('@/lib/cover');
  const { COVER_KEY } = await import('@/lib/cover-store');
  const out: Record<string, string> = {};
  for (const k of Object.keys(COVER_DEFAULT) as (keyof typeof COVER_DEFAULT)[]) {
    const v = str(f, k).replace(/\s+/g, ' ').trim();
    if (v.length > COVER_LIMITS[k]) return { error: 'Satırlardan biri çok uzun.' };
    out[k] = v;
  }
  const { error } = await db().from('settings').upsert({ key: COVER_KEY, value: JSON.stringify(out), updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath('/');
  revalidatePath('/yonetim/kapak');
  return { ok: 'Kapak kaydedildi. Okurlar bir sonraki açılışta yenisini görür.' };
}

// —— İstatistikleri sıfırla ————————————————————————————————————————

export async function resetStatsAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  if (str(f, 'confirm').trim().toLocaleLowerCase('tr-TR') !== 'sıfırla') return { error: 'Onay için kutuya “sıfırla” yaz.' };
  const views = str(f, 'views') === '1';
  const fails = str(f, 'fails') === '1';
  if (!views && !fails) return { error: 'Sıfırlanacak bir şey seç.' };
  const sb = db();
  if (views) {
    // Okuma kayıtları ve biten oturumlar silinir; şu an içeride olan okurlar atılmaz.
    const r1 = await sb.from('page_views').delete().gte('id', 0);
    if (r1.error) return { error: r1.error.message };
    const now = Date.now();
    const r2 = await sb.from('reader_sessions').delete()
      .or(`ended_at.not.is.null,expires_at.lt."${new Date(now).toISOString()}",last_seen_at.lt."${new Date(now - 30 * 60000).toISOString()}"`);
    if (r2.error) return { error: r2.error.message };
  }
  if (fails) {
    const r3 = await sb.from('pin_attempts').delete().gte('id', 0);
    if (r3.error) return { error: r3.error.message };
    await sb.from('ip_blocks').delete().gte('until', '1970-01-01');
  }
  revalidatePath('/yonetim', 'layout');
  return { ok: 'İstatistikler sıfırlandı.' };
}
