/**
 * Okurun nereden geldiği. Üç ipucuna bakar:
 * 1) bağlantıdaki etiketler (utm_source, fbclid, igsh, gclid…)
 * 2) uygulama içi tarayıcının user-agent'ı (Instagram, Facebook, TikTok…)
 * 3) yönlendiren sayfa (document.referrer)
 * Hiçbiri yoksa "Doğrudan" (adres yazılmış, WhatsApp/DM'den açılmış ya da yer imi).
 */

export const SOURCES = ['Instagram', 'Facebook', 'Google', 'X', 'WhatsApp', 'Telegram', 'TikTok', 'YouTube', 'LinkedIn', 'Threads', 'WordPress', 'Doğrudan'] as const;

const HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'Facebook'],
  [/(^|\.)threads\.(net|com)$/, 'Threads'],
  [/(^|\.)google\.[a-z.]+$|(^|\.)googleusercontent\.com$/, 'Google'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, 'Telegram'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)wordpress\.com$|(^|\.)wp\.me$/, 'WordPress'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)yandex\.[a-z.]+$/, 'Yandex'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
  [/(^|\.)pinterest\.[a-z.]+$|(^|\.)pin\.it$/, 'Pinterest'],
  [/(^|\.)bsky\.app$/, 'Bluesky'],
  [/(^|\.)(mail\.google\.com|outlook\.(live|office)\.com|mail\.yahoo\.com)$/, 'E-posta']
];

const UTM: Record<string, string> = {
  ig: 'Instagram', instagram: 'Instagram', fb: 'Facebook', facebook: 'Facebook', google: 'Google',
  twitter: 'X', x: 'X', whatsapp: 'WhatsApp', wa: 'WhatsApp', telegram: 'Telegram', tg: 'Telegram',
  tiktok: 'TikTok', youtube: 'YouTube', yt: 'YouTube', linkedin: 'LinkedIn', threads: 'Threads',
  wordpress: 'WordPress', email: 'E-posta', mail: 'E-posta'
};

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

export function detectSource(ref: string, search: string, ua: string, selfHost: string | null): { source: string; ref: string | null } {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const host = ref ? hostOf(ref) : null;
  const external = host && (!selfHost || (host !== selfHost.replace(/^www\./, '') && !host.endsWith('.vercel.app'))) ? host : null;
  const refOut = external; // yalnızca alan adı saklanır

  // 1) açık etiket
  const utm = (params.get('utm_source') || params.get('ref') || params.get('kaynak') || '').trim().toLowerCase();
  if (utm) {
    const known = UTM[utm] ?? Object.entries(UTM).find(([k]) => utm.includes(k))?.[1];
    if (known) return { source: known, ref: refOut };
    const clean = utm.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 24);
    if (clean) return { source: clean.charAt(0).toLocaleUpperCase('tr-TR') + clean.slice(1), ref: refOut };
  }

  // 2) uygulama içi tarayıcı
  if (/Instagram/i.test(ua) || params.has('igsh') || params.has('igshid')) return { source: 'Instagram', ref: refOut };
  if (/Barcelona|Threads/i.test(ua)) return { source: 'Threads', ref: refOut };
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger/i.test(ua)) return { source: 'Facebook', ref: refOut };
  if (/musical_ly|TikTok|BytedanceWebview|trill/i.test(ua)) return { source: 'TikTok', ref: refOut };
  if (/Twitter/i.test(ua)) return { source: 'X', ref: refOut };
  if (/LinkedInApp/i.test(ua)) return { source: 'LinkedIn', ref: refOut };
  if (/Telegram/i.test(ua)) return { source: 'Telegram', ref: refOut };
  if (/WhatsApp/i.test(ua)) return { source: 'WhatsApp', ref: refOut };
  if (/Snapchat/i.test(ua)) return { source: 'Snapchat', ref: refOut };

  // 3) yönlendiren sayfa
  if (external) {
    for (const [re, name] of HOSTS) if (re.test(external)) return { source: name, ref: refOut };
  }
  if (params.has('fbclid')) return { source: 'Facebook', ref: refOut };
  if (params.has('gclid')) return { source: 'Google', ref: refOut };
  if (params.has('twclid')) return { source: 'X', ref: refOut };
  if (external) return { source: external.slice(0, 40), ref: refOut };
  return { source: 'Doğrudan', ref: null };
}
