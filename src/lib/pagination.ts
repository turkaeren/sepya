// İçerikten tam ekran sayfalar üretir. Okur tarafı ve yönetim önizlemesi aynı kuralı kullanır.
import { dateLabel } from './format';

export type Category = 'siir' | 'not' | 'defter';
export type SortDir = 'desc' | 'asc';
export type Mode = 'hepsi' | Category;

export interface EntryLite {
  id: string;
  title: string;
  content: string;
  category: Category;
  entry_date: string;
  sort_order?: number;
  cover_url?: string | null;
}

export interface Para { t: string; cont: boolean }
export interface Chunk { poem?: string; paras?: Para[] }

export interface PageData {
  key: string;
  kind: 'title' | 'section' | 'entry' | 'empty' | 'cover' | 'read';
  top: string;
  counter: string;
  mid: boolean;
  // section
  label?: string;
  epi?: string;
  countLabel?: string;
  // entry
  entryId?: string;
  title?: string;
  category?: Category;
  part?: number;
  parts?: number;
  isFirst?: boolean;
  partLabel?: string;
  hasMore?: boolean;
  poem?: string;
  paras?: Para[];
  // cover (yazılar arası geçiş sayfası)
  coverSrc?: string | null;
}

export const CATS: Record<Category, { label: string; one: string; many: string; epi: string }> = {
  siir: { label: 'Şiirler', one: 'şiir', many: 'şiir', epi: 'Bazı şeyler ancak satır sonunda söylenebilir.' },
  not: { label: 'Notlar', one: 'not', many: 'not', epi: 'Düşünmek, yavaş yürümenin başka bir adı.' },
  defter: { label: 'Defter', one: 'defter', many: 'defter sayfası', epi: 'Günler kaybolmasın diye değil; ben kaybolmayayım diye.' }
};

const FIRST = 15; // ilk sayfada başlık yer kapladığı için daha az satır
const NEXT = 17;
const CPL = 40; // düzyazıda satır başına ortalama karakter (390px, 18px EB Garamond)

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const roman = (n: number) => ROMAN[n - 1] || String(n);
const pad2 = (n: number) => String(n).padStart(2, '0');

export function paginatePoem(body: string): Chunk[] {
  const raw = body.replace(/\r/g, '').trim().split(/\n\s*\n/).map((s) => s.split('\n').map((l) => l.trim()));
  const stanzas: string[][] = [];
  for (let i = 0; i < raw.length; i++) {
    // Tek satırlık kıta (ör. "II.") sonraki kıtayla birlikte kalır, sayfa sonunda yalnız kalmaz.
    if (raw[i].length === 1 && i < raw.length - 1) raw[i + 1] = [raw[i][0], ''].concat(raw[i + 1]);
    else stanzas.push(raw[i]);
  }
  const pages: string[][] = [];
  let cur: string[] = [];
  let budget = FIRST;
  for (let s of stanzas) {
    // Bütçeden uzun kıtayı satır satır böl
    while (s.length > NEXT) {
      if (cur.length) { pages.push(cur); cur = []; budget = NEXT; }
      pages.push(s.slice(0, budget));
      s = s.slice(budget);
      budget = NEXT;
    }
    const need = (cur.length ? 1 : 0) + s.length;
    if (cur.length && cur.length + need > budget) { pages.push(cur); cur = []; budget = NEXT; }
    if (cur.length) cur.push('');
    cur = cur.concat(s);
  }
  if (cur.length) pages.push(cur);
  if (!pages.length) pages.push(['']);
  return pages.map((ls) => ({ poem: ls.join('\n') }));
}

export function paginateProse(body: string): Chunk[] {
  const paras = body.replace(/\r/g, '').trim().split(/\n\s*\n/).map((s) => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const L = (t: string) => Math.max(1, Math.ceil((t.length + 5) / CPL));
  const q: Para[] = paras.map((t, i) => ({ t, cont: i === 0 }));
  const pages: Para[][] = [];
  let cur: Para[] = [];
  let used = 0;
  let budget = FIRST;
  while (q.length) {
    const p = q.shift()!;
    const n = L(p.t);
    if (used + n <= budget) { cur.push(p); used += n; continue; }
    const sents = p.t.match(/[^.!?…]+[.!?…]+[”"’)]?\s*/g);
    let head = '';
    let i = 0;
    if (sents && sents.join('').length === p.t.length) {
      while (i < sents.length - 1 && used + L(head + sents[i]) <= budget) { head += sents[i]; i++; }
    }
    if (head) {
      cur.push({ t: head.trim(), cont: p.cont });
      q.unshift({ t: sents!.slice(i).join('').trim(), cont: true });
    } else if (!cur.length) {
      cur.push(p);
    } else {
      q.unshift(p);
    }
    pages.push(cur); cur = []; used = 0; budget = NEXT;
  }
  if (cur.length) pages.push(cur);
  if (!pages.length) pages.push([{ t: '', cont: true }]);
  return pages.map((ps) => ({ paras: ps }));
}

export function paginate(e: Pick<EntryLite, 'content' | 'category'>): Chunk[] {
  return e.category === 'siir' ? paginatePoem(e.content) : paginateProse(e.content);
}

export function sortEntries<T extends EntryLite>(list: T[], dir: SortDir): T[] {
  return list.slice().sort((a, b) => {
    const c = dir === 'asc' ? a.entry_date.localeCompare(b.entry_date) : b.entry_date.localeCompare(a.entry_date);
    return c !== 0 ? c : (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

/** Bir içeriğin sayfalarını tek başına üretir (önizleme için). */
export function entryPages(e: Omit<EntryLite, 'id'> & { id?: string }): PageData[] {
  const chunks = paginate(e);
  return chunks.map((c, i) => ({
    key: `${e.id ?? 'onizleme'}:${i + 1}`,
    kind: 'entry' as const,
    top: e.entry_date ? dateLabel(e.entry_date) : '',
    counter: `${pad2(i + 1)} / ${pad2(chunks.length)}`,
    mid: chunks.length === 1,
    entryId: e.id,
    title: e.title || 'Başlıksız',
    category: e.category,
    part: i + 1,
    parts: chunks.length,
    isFirst: i === 0,
    partLabel: `${roman(i + 1)} / ${roman(chunks.length)}`,
    hasMore: i < chunks.length - 1,
    ...c
  }));
}


/** Okurda kullanılan kapak adresi. Yol, yalnızca önbelleği yenilemek için sürüm olarak eklenir. */
export function coverSrcFor(id: string | undefined, cover: string | null | undefined): string | null {
  if (!id || !cover) return null;
  return `/api/cover/${id}?v=${encodeURIComponent(cover)}`;
}

/** Yazının tamamı tek sayfada, aşağı kaydırılarak okunur. */
export function fullChunk(e: Pick<EntryLite, 'content' | 'category'>): Chunk {
  const text = e.content.replace(/\r/g, '').trim();
  if (e.category === 'siir') {
    const poem = text.split('\n').map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n');
    return { poem };
  }
  const paras = text.split(/\n\s*\n/).map((s) => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  return { paras: (paras.length ? paras : ['']).map((t, i) => ({ t, cont: i === 0 })) };
}

/**
 * Bir yazının okur sayfaları: önce başlık (varsa görsel) geçiş sayfası, sonra kaydırılarak okunan yazı.
 * Okur tarafı ve yönetim önizlemesi aynı işlevi kullanır.
 */
export function entryReadPages(e: Omit<EntryLite, 'id'> & { id?: string }, coverSrc?: string | null, counter = ''): PageData[] {
  const key = e.id ?? 'onizleme';
  const top = e.entry_date ? dateLabel(e.entry_date) : '';
  const title = e.title || 'Başlıksız';
  const src = coverSrc !== undefined ? coverSrc : coverSrcFor(e.id, e.cover_url);
  return [
    { key: `${key}:kapak`, kind: 'cover', top, counter, mid: true, entryId: e.id, title, category: e.category, coverSrc: src, part: 0, parts: 1 },
    { key: `${key}:oku`, kind: 'read', top, counter, mid: false, entryId: e.id, title, category: e.category, part: 1, parts: 1, isFirst: true, ...fullChunk(e) }
  ];
}

export interface Sequence { pages: PageData[]; first: Record<string, number> }

export function buildSequence(all: EntryLite[], mode: Mode, dir: SortDir): Sequence {
  const list = sortEntries(mode === 'hepsi' ? all : all.filter((e) => e.category === mode), dir);
  const pages: PageData[] = [];
  const first: Record<string, number> = {};
  if (!list.length) {
    pages.push({ key: 'bos', kind: 'empty', top: '', counter: '—', mid: true });
    return { pages, first };
  }
  if (mode === 'hepsi') {
    const latest = sortEntries(all, 'desc')[0];
    pages.push({ key: 'acilis', kind: 'title', top: dateLabel(latest.entry_date), counter: '', mid: true });
  } else {
    const c = CATS[mode];
    pages.push({
      key: 'bolum-' + mode, kind: 'section', top: '', counter: '', mid: true,
      label: c.label, epi: c.epi,
      countLabel: `${list.length} ${c.many} · ${dir === 'asc' ? 'eskiden yeniye' : 'yeniden eskiye'}`
    });
  }
  list.forEach((e, i) => {
    first[e.id] = pages.length;
    for (const p of entryReadPages(e, undefined, `${pad2(i + 1)} / ${pad2(list.length)}`)) pages.push(p);
  });
  return { pages, first };
}
