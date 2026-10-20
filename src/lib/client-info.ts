import 'server-only';
import { headers } from 'next/headers';

export interface ClientInfo {
  ip: string | null;
  country: string | null;
  city: string | null;
  device: string;
  os: string;
  browser: string;
  userAgent: string;
  referer: string | null;
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]+$/i;

function cleanIp(raw: string | null): string | null {
  if (!raw) return null;
  const ip = raw.split(',')[0].trim();
  if (IPV4.test(ip) || (ip.includes(':') && IPV6.test(ip))) return ip;
  return null;
}

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string | null) {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return null;
  try {
    regionNames = regionNames || new Intl.DisplayNames(['tr'], { type: 'region' });
    return regionNames.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

/** Kaba ve yeterli bir user-agent ayrıştırıcı; parmak izi çıkarmaz, yalnızca genel türü verir. */
export function parseUA(ua: string) {
  let device = 'Diğer';
  let os = 'Bilinmiyor';
  let browser = 'Diğer';

  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) { device = 'iPad'; os = 'iPadOS'; }
  else if (/iPhone/.test(ua)) { device = 'iPhone'; os = 'iOS'; }
  else if (/Android/.test(ua)) { device = /Mobile/.test(ua) ? 'Android' : 'Android tablet'; os = 'Android'; }
  else if (/Macintosh|Mac OS X/.test(ua)) { device = 'Mac'; os = 'macOS'; }
  else if (/Windows/.test(ua)) { device = 'Windows'; os = 'Windows'; }
  else if (/Linux/.test(ua)) { device = 'Linux'; os = 'Linux'; }

  const iosV = ua.match(/OS (\d+)[_.]\d+.* like Mac OS X/);
  if (iosV && (os === 'iOS' || os === 'iPadOS')) os += ' ' + iosV[1];
  const andV = ua.match(/Android (\d+)/);
  if (andV && os === 'Android') os += ' ' + andV[1];

  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  if (/bot|crawl|spider|curl|wget|python|httpclient/i.test(ua)) { device = 'Bot'; browser = 'Bot'; }
  return { device, os, browser };
}

export async function clientInfo(): Promise<ClientInfo> {
  const h = await headers();
  const ua = (h.get('user-agent') || '').slice(0, 400);
  const city = h.get('x-vercel-ip-city');
  let cityName: string | null = null;
  try { cityName = city ? decodeURIComponent(city) : null; } catch { cityName = city; }
  const ref = h.get('referer');
  const host = h.get('host');
  let referer: string | null = null;
  if (ref) {
    try {
      const u = new URL(ref);
      referer = host && u.host === host ? null : u.host; // yalnızca alan adı; tam adres saklanmaz
    } catch { referer = null; }
  }
  return {
    ip: cleanIp(h.get('x-forwarded-for')) || cleanIp(h.get('x-real-ip')),
    country: countryName(h.get('x-vercel-ip-country')),
    city: cityName,
    ...parseUA(ua),
    userAgent: ua,
    referer
  };
}

/** API rotalarında yalnızca kendi sitemizden gelen isteği kabul et (CSRF). */
export async function isSameOrigin() {
  const h = await headers();
  const site = h.get('sec-fetch-site');
  if (site && site !== 'same-origin') return false;
  const origin = h.get('origin');
  const host = h.get('x-forwarded-host') || h.get('host');
  if (origin && host) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  return site === 'same-origin';
}
