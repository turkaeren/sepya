// Türkçe tarih/saat biçimleri. Tüm gün hesapları İstanbul saatine göredir.

export const TZ = 'Europe/Istanbul';
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export const upTR = (s: string) => s.toLocaleUpperCase('tr-TR');
export const lowTR = (s: string) => s.toLocaleLowerCase('tr-TR');

export function ymd(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

/** "2026-10-21" → "21 EKİM 2026" */
export function dateLabel(iso: string) {
  const { y, m, d } = ymd(iso);
  return `${d} ${upTR(MONTHS[m - 1])} ${y}`;
}

/** "2026-10-21" → "21.10.2026" */
export function dateDots(iso: string) {
  const { y, m, d } = ymd(iso);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

function parts(ts: string | Date) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
  if (o.hour === '24') o.hour = '00';
  return o;
}

/** Zaman damgasının İstanbul'daki günü: "2026-10-21" */
export function istDay(ts: string | Date) {
  const o = parts(ts);
  return `${o.year}-${o.month}-${o.day}`;
}
export function istHour(ts: string | Date) {
  return Number(parts(ts).hour);
}
/** "00:14" */
export function hm(ts: string | Date) {
  const o = parts(ts);
  return `${o.hour}:${o.minute}`;
}
/** "00:14:22" */
export function hms(ts: string | Date) {
  const o = parts(ts);
  return `${o.hour}:${o.minute}:${o.second}`;
}
/** "21 Eki 00:14" */
export function shortDT(ts: string | Date) {
  const o = parts(ts);
  return `${Number(o.day)} ${MONTHS_SHORT[Number(o.month) - 1]} ${o.hour}:${o.minute}`;
}
/** "21.10.2026 00:14" */
export function dotsDT(ts: string | Date) {
  const o = parts(ts);
  return `${o.day}.${o.month}.${o.year} ${o.hour}:${o.minute}`;
}

export function fmtDuration(ms: number | null | undefined) {
  if (ms == null || !isFinite(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} sn`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk${s % 60 ? ' ' + String(s % 60).padStart(2, '0') + ' sn' : ''}`;
  const h = Math.floor(m / 60);
  return `${h} sa ${m % 60} dk`;
}
export function fmtMinutes(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  return m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa ${m % 60} dk`;
}

export function nf(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n);
}

/** İstanbul'da bugünden geriye n gün: ["2026-10-08", ... "2026-10-21"] */
export function lastDays(n: number, now = new Date()) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(istDay(new Date(now.getTime() - i * 86400000)));
  return out;
}
