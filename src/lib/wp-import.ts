import 'server-only';
import type { Category } from './pagination';

export interface ImportedPost {
  title: string;
  content: string;
  category: Category;
  entry_date: string; // YYYY-MM-DD
  sourceId: string;
}

// —— HTML → düz metin ——————————————————————————————————————————————

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', bull: '•',
  ccedil: 'ç', Ccedil: 'Ç', ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü', acirc: 'â', icirc: 'î', ucirc: 'û', eacute: 'é'
};
export function decodeEntities(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n] ?? m);
}

export function htmlToText(html: string) {
  let s = html.replace(/\r/g, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');                                     // Gutenberg blok yorumları
  s = s.replace(/<(script|style|iframe|figure|figcaption|video|audio|object|noscript)[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<img[^>]*>/gi, '');                                          // görseller alınmıyor
  s = s.replace(/\[caption[^\]]*\][\s\S]*?\[\/caption\]/gi, '').replace(/\[\/?[a-z_]+[^\]]*\]/gi, ''); // kısa kodlar
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|h[1-6]|li|blockquote|pre|ul|ol|tr|section|article)>/gi, '\n\n');
  s = s.replace(/<(p|div|h[1-6]|li|blockquote|pre|ul|ol|tr|section|article)[^>]*>/gi, '\n');
  s = s.replace(/<hr[^>]*>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  s = s.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

/** Şiir mi düzyazı mı? Kısa satırlar çoğunluktaysa şiir (satır düzeni korunur). */
export function classify(text: string, cats: string[]): Category {
  const c = cats.map((x) => x.toLocaleLowerCase('tr-TR')).join(' ');
  if (/şiir|siir|poem|poetry/.test(c)) return 'siir';
  if (/defter|günlük|gunluk|diary/.test(c)) return 'defter';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return 'not';
  const short = lines.filter((l) => l.length <= 70).length;
  const avg = lines.reduce((a, l) => a + l.length, 0) / lines.length;
  const paragraphsWithBreaks = text.split(/\n\s*\n/).filter((p) => p.includes('\n')).length;
  if (short / lines.length >= 0.7 && avg <= 60 && (paragraphsWithBreaks > 0 || lines.length >= 4)) return 'siir';
  return 'not';
}

function ymdFrom(dateStr: string) {
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : new Date().toISOString().slice(0, 10);
}

function titleOr(title: string, text: string) {
  const t = decodeEntities(title.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  if (t) return t.slice(0, 200);
  const first = text.split('\n').find((l) => l.trim()) ?? 'Başlıksız';
  return first.length > 60 ? first.slice(0, 57).trimEnd() + '…' : first;
}

// —— WordPress.com herkese açık API ——————————————————————————————————

export class ImportError extends Error {}

export async function fetchFromWordPressCom(siteRaw: string): Promise<ImportedPost[]> {
  const site = siteRaw.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(site)) throw new ImportError('Site adresi geçersiz.');
  const out: ImportedPost[] = [];
  for (let page = 1; page <= 50; page++) {
    const url = `https://public-api.wordpress.com/rest/v1.1/sites/${encodeURIComponent(site)}/posts/?number=100&page=${page}&status=publish&type=post&order_by=date&order=DESC&fields=ID,title,date,content,categories`;
    const res = await fetch(url, { cache: 'no-store', headers: { 'user-agent': 'sepya-import/1.0' } });
    if (res.status === 403 || res.status === 401) throw new ImportError('Blog gizli görünüyor; WordPress dışa aktarma dosyasıyla devam et.');
    if (res.status === 404) throw new ImportError('Bu adreste bir WordPress.com blogu bulunamadı.');
    if (!res.ok) throw new ImportError(`WordPress yanıt vermedi (${res.status}).`);
    const data = await res.json() as { found: number; posts: { ID: number; title: string; date: string; content: string; categories?: Record<string, { name: string }> }[] };
    for (const p of data.posts ?? []) {
      const text = htmlToText(p.content ?? '');
      if (!text) continue;
      const cats = Object.values(p.categories ?? {}).map((c) => c.name);
      out.push({ sourceId: String(p.ID), title: titleOr(p.title ?? '', text), content: text, category: classify(text, cats), entry_date: ymdFrom(p.date) });
    }
    if (!data.posts?.length || out.length >= (data.found ?? 0) || data.posts.length < 100) break;
  }
  return out;
}

// —— WordPress dışa aktarma dosyası (WXR) ————————————————————————————

function tag(xml: string, name: string) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  const v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1] : decodeEntities(v);
}

export function parseWxr(xml: string): ImportedPost[] {
  if (!/<rss[\s>]/i.test(xml) || !/wordpress\.org\/export/i.test(xml)) throw new ImportError('Bu bir WordPress dışa aktarma dosyası değil.');
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const out: ImportedPost[] = [];
  for (const it of items) {
    if (tag(it, 'wp:post_type') !== 'post') continue;
    if (tag(it, 'wp:status') !== 'publish') continue;
    const text = htmlToText(tag(it, 'content:encoded'));
    if (!text) continue;
    const cats = [...it.matchAll(/<category domain="category"[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/gi)].map((m) => m[1]);
    out.push({
      sourceId: tag(it, 'wp:post_id'),
      title: titleOr(tag(it, 'title'), text),
      content: text,
      category: classify(text, cats),
      entry_date: ymdFrom(tag(it, 'wp:post_date') || tag(it, 'pubDate'))
    });
  }
  return out;
}
