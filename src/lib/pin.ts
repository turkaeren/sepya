import 'server-only';
import { db } from './db';
import { hashSecret, verifySecret } from './crypto';
import type { ClientInfo } from './client-info';

/** Kaba kuvvet koruması. Yönetim › Güvenlik ekranı da bu değerleri gösterir. */
export const PIN_RULES = {
  waitEvery: 5,          // her 5 ardışık hatada
  waitSeconds: 30,       // 30 sn bekleme
  burstLimit: 8,         // 15 dk içinde 8 hata (aynı IP)
  burstWindowMin: 15,
  burstBlockMin: 15,     // → IP 15 dk engel
  dailyLimit: 20,        // 24 sa içinde 20 hata (aynı IP)
  dailyBlockHours: 24,   // → IP 24 sa engel
  globalLimit: 60,       // tüm IP'lerden 15 dk içinde 60 hata
  globalWaitSeconds: 60  // → herkes için 60 sn bekleme (dağıtık deneme)
};

export type PinResult =
  | { state: 'ok' }
  | { state: 'fail'; left: number }
  | { state: 'wait'; retryAfter: number }
  | { state: 'blocked'; retryAfter: number }
  | { state: 'unset' };

const PIN_KEY = 'reader_pin_hash';

export async function setReaderPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN dört rakam olmalı.');
  const value = await hashSecret(pin);
  const { error } = await db().from('settings').upsert({ key: PIN_KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function pinInfo() {
  const { data } = await db().from('settings').select('updated_at').eq('key', PIN_KEY).maybeSingle();
  return data ? { updatedAt: data.updated_at as string } : null;
}

let curSource: string | null = null;
async function record(info: ClientInfo, success: boolean, outcome: 'ok' | 'fail' | 'wait' | 'blocked', name: string | null) {
  await db().from('pin_attempts').insert({
    name, source: curSource, ip: info.ip, country: info.country, city: info.city, device: info.device, os: info.os,
    browser: info.browser, user_agent: info.userAgent, success, outcome
  });
}

const secondsUntil = (t: number) => Math.max(1, Math.ceil((t - Date.now()) / 1000));

export async function attemptPin(pin: string, info: ClientInfo, name: string | null = null, source: string | null = null): Promise<PinResult> {
  curSource = source;
  const now = Date.now();
  const sb = db();

  // 1) Engelli IP
  if (info.ip) {
    const { data: block } = await sb.from('ip_blocks').select('until').eq('ip', info.ip).maybeSingle();
    if (block && new Date(block.until).getTime() > now) {
      await record(info, false, 'blocked', name);
      return { state: 'blocked', retryAfter: secondsUntil(new Date(block.until).getTime()) };
    }
  }

  // 2) Dağıtık deneme koruması
  const since15 = new Date(now - PIN_RULES.burstWindowMin * 60000).toISOString();
  const { count: globalFails } = await sb.from('pin_attempts').select('id', { count: 'exact', head: true })
    .eq('outcome', 'fail').gte('attempted_at', since15);
  if ((globalFails ?? 0) >= PIN_RULES.globalLimit) {
    await record(info, false, 'wait', name);
    return { state: 'wait', retryAfter: PIN_RULES.globalWaitSeconds };
  }

  // 3) Ardışık hatalar → kısa bekleme
  let recent: { attempted_at: string; outcome: string }[] = [];
  if (info.ip) {
    const { data } = await sb.from('pin_attempts').select('attempted_at, outcome')
      .eq('ip', info.ip).gte('attempted_at', new Date(now - 86400000).toISOString())
      .order('attempted_at', { ascending: false }).limit(60);
    recent = data ?? [];
  }
  let consecutive = 0;
  let lastFailAt = 0;
  for (const r of recent) {
    if (r.outcome === 'ok') break;
    if (r.outcome === 'fail') {
      consecutive++;
      if (!lastFailAt) lastFailAt = new Date(r.attempted_at).getTime();
    }
  }
  if (consecutive > 0 && consecutive % PIN_RULES.waitEvery === 0) {
    const until = lastFailAt + PIN_RULES.waitSeconds * 1000;
    if (until > now) {
      await record(info, false, 'wait', name);
      return { state: 'wait', retryAfter: secondsUntil(until) };
    }
  }

  // 4) Doğrulama (yalnızca hash ile; PIN hiçbir yere yazılmaz)
  const { data: setting } = await sb.from('settings').select('value').eq('key', PIN_KEY).maybeSingle();
  if (!setting) return { state: 'unset' };
  const ok = /^\d{4}$/.test(pin) && (await verifySecret(setting.value, pin));

  if (ok) {
    await record(info, true, 'ok', name);
    return { state: 'ok' };
  }

  await record(info, false, 'fail', name);
  const fails = consecutive + 1;
  if (info.ip) {
    const t15 = now - PIN_RULES.burstWindowMin * 60000;
    const fails15 = recent.filter((r) => r.outcome === 'fail' && new Date(r.attempted_at).getTime() >= t15).length + 1;
    const fails24 = recent.filter((r) => r.outcome === 'fail').length + 1;
    let blockMs = 0;
    let reason = '';
    if (fails24 >= PIN_RULES.dailyLimit) { blockMs = PIN_RULES.dailyBlockHours * 3600000; reason = `24 saatte ${fails24} hatalı PIN`; }
    else if (fails15 >= PIN_RULES.burstLimit) { blockMs = PIN_RULES.burstBlockMin * 60000; reason = `15 dakikada ${fails15} hatalı PIN`; }
    if (blockMs) {
      const until = new Date(now + blockMs).toISOString();
      await sb.from('ip_blocks').upsert({ ip: info.ip, until, reason, created_at: new Date().toISOString() });
      return { state: 'blocked', retryAfter: Math.ceil(blockMs / 1000) };
    }
  }
  if (fails % PIN_RULES.waitEvery === 0) return { state: 'wait', retryAfter: PIN_RULES.waitSeconds };
  return { state: 'fail', left: PIN_RULES.waitEvery - (fails % PIN_RULES.waitEvery) };
}
