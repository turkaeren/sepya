'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSequence, CATS, sortEntries, type Category, type EntryLite, type Mode, type PageData, type SortDir } from '@/lib/pagination';
import { MONTHS, upTR, ymd } from '@/lib/format';
import { ArrowL, Dots, Grain, Page } from './Page';
import './reader.css';

type View = 'read' | 'archive';
type Turn = { from: PageData; cls: string } | null;

function track(payload: Record<string, unknown>, beacon = false) {
  const body = JSON.stringify(payload);
  if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    return;
  }
  fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, credentials: 'same-origin', keepalive: true })
    .then((r) => { if (r.status === 401) window.location.reload(); })
    .catch(() => {});
}

const locative = (y: string) => y + '’' + ['de', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da'][Number(y.slice(-1))];

export default function Reader({ entries, name }: { entries: EntryLite[]; name: string }) {
  const [view, setView] = useState<View>('read');
  const [mode, setMode] = useState<Mode>('hepsi');
  const [sort, setSort] = useState<SortDir>('desc');
  const [idx, setIdx] = useState(0);
  const [turn, setTurn] = useState<Turn>(null);
  const [menu, setMenu] = useState(false);
  const flip = useRef(false);
  const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swipedAt = useRef(0);

  const seq = useMemo(() => buildSequence(entries, mode, sort), [entries, mode, sort]);
  const allSeq = useMemo(() => buildSequence(entries, 'hepsi', sort), [entries, sort]);
  const page = seq.pages[Math.min(idx, seq.pages.length - 1)];

  // Okuma kaydı: görünen sayfa değişince
  useEffect(() => {
    if (view !== 'read' || menu) return;
    track({ kind: page.kind, entryId: page.entryId, part: page.part, category: page.category, label: page.title || page.label || null });
  }, [page.key, view, menu]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') track({ kind: 'leave' }, true); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const go = useCallback((d: number) => {
    const n = idx + d;
    if (n < 0 || n >= seq.pages.length) return;
    flip.current = !flip.current;
    setTurn({ from: seq.pages[idx], cls: (d > 0 ? 'next' : 'prev') + '-' + (flip.current ? 'a' : 'b') });
    setIdx(n);
    if (turnTimer.current) clearTimeout(turnTimer.current);
    turnTimer.current = setTimeout(() => setTurn(null), 640);
  }, [idx, seq.pages]);

  useEffect(() => {
    if (view !== 'read' || menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, view, menu]);

  function openRead(m: Mode, i: number) {
    setMode(m); setIdx(i); setTurn(null); setView('read'); setMenu(false);
  }

  function openMenu() {
    setMenu(true);
    track({ kind: 'menu' });
  }
  function openArchive() {
    setView('archive'); setMenu(false);
    track({ kind: 'archive' });
  }

  // —— Arşiv
  const [yil, setYil] = useState('tümü');
  const [ay, setAy] = useState('tümü');
  const [tur, setTur] = useState<'hepsi' | Category>('hepsi');
  const years = useMemo(() => Array.from(new Set(entries.map((e) => e.entry_date.slice(0, 4)))).sort().reverse(), [entries]);
  const months = useMemo(() => yil === 'tümü' ? [] :
    Array.from(new Set(entries.filter((e) => e.entry_date.startsWith(yil)).map((e) => ymd(e.entry_date).m))).sort((a, b) => b - a), [entries, yil]);
  const groups = useMemo(() => {
    const list = sortEntries(entries, sort)
      .filter((e) => yil === 'tümü' || e.entry_date.startsWith(yil))
      .filter((e) => tur === 'hepsi' || e.category === tur)
      .filter((e) => yil === 'tümü' || ay === 'tümü' || String(ymd(e.entry_date).m) === ay);
    const out: { year: string; months: { label: string; items: EntryLite[] }[] }[] = [];
    for (const e of list) {
      const t = ymd(e.entry_date);
      let g = out[out.length - 1];
      if (!g || g.year !== String(t.y)) { g = { year: String(t.y), months: [] }; out.push(g); }
      let m = g.months[g.months.length - 1];
      const label = upTR(MONTHS[t.m - 1]);
      if (!m || m.label !== label) { m = { label, items: [] }; g.months.push(m); }
      m.items.push(e);
    }
    return out;
  }, [entries, sort, yil, ay, tur]);

  const emptyMsg = yil !== 'tümü' && tur !== 'hepsi'
    ? `${locative(yil)} hiç ${CATS[tur].many} yazılmamış.`
    : yil !== 'tümü' ? 'O ay hiçbir şey yazılmamış.' : 'Bu aralıkta yazılmış bir şey yok.';

  const Opt = ({ on, label, pick }: { on: boolean; label: string; pick: () => void }) => (
    <button type="button" className={'flt' + (on ? ' on' : '')} aria-pressed={on} onClick={pick}><span className="lbl">{label}</span></button>
  );

  const counts = (k: Category) => entries.filter((e) => e.category === k).length;
  const nav: { label: string; count: string; on: boolean; go: () => void }[] = [
    { label: 'Ana sayfa', count: '', on: view === 'read' && mode === 'hepsi', go: () => openRead('hepsi', 0) },
    { label: 'Şiirler', count: String(counts('siir')), on: view === 'read' && mode === 'siir', go: () => openRead('siir', 0) },
    { label: 'Notlar', count: String(counts('not')), on: view === 'read' && mode === 'not', go: () => openRead('not', 0) },
    { label: 'Defter', count: String(counts('defter')), on: view === 'read' && mode === 'defter', go: () => openRead('defter', 0) },
    { label: 'Arşiv', count: String(entries.length), on: view === 'archive', go: openArchive }
  ];

  return (
    <div className="sp">
      {view === 'read' && (
        <main className="scr screen">
          <div
            className="stage"
            onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
            onPointerUp={(e) => {
              const s = swipe.current; swipe.current = null;
              if (!s) return;
              const dx = e.clientX - s.x, dy = e.clientY - s.y;
              if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.3) { swipedAt.current = Date.now(); go(dx < 0 ? 1 : -1); }
            }}
          >
            <Page pg={page} reader={name} grainId="g-cur" />
            {turn && <div className={'under ' + turn.cls} aria-hidden="true" />}
            {turn && (
              <div className={'turn ' + turn.cls} aria-hidden="true">
                <Page pg={turn.from} reader={name} grainId="g-turn" />
                <div className="tshade" />
              </div>
            )}
            <button type="button" className="tbtn edge l" aria-label="Önceki sayfa"
              onClick={() => { if (Date.now() - swipedAt.current > 400) go(-1); }} />
            <button type="button" className="tbtn edge r" aria-label="Sonraki sayfa"
              onClick={() => { if (Date.now() - swipedAt.current > 400) go(1); }} />
          </div>
          <button type="button" className="tbtn menubtn" aria-label="Menüyü aç" onClick={openMenu}><Dots /></button>
        </main>
      )}

      {view === 'archive' && (
        <main className="scr archive">
          <Grain id="g-arsiv" />
          <div className="topbar">
            <button type="button" className="tbtn" onClick={() => setView('read')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontStyle: 'italic', padding: '0 8px 0 6px' }}>
              <ArrowL /> okumaya dön
            </button>
            <button type="button" className="tbtn" aria-label="Menüyü aç" onClick={openMenu} style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Dots /></button>
          </div>
          <div className="scroll"><div>
            <h1 className="disp rise" style={{ margin: 0, fontSize: 48, fontWeight: 500, lineHeight: 1 }}>Arşiv</h1>
            <p className="rise" style={{ margin: '10px 0 24px', fontSize: 17, fontStyle: 'italic', color: 'var(--soft)' }}>Yazıldıkları güne göre.</p>

            <div className="filters">
              <div className="frow"><span className="meta">Yıl</span><div className="opts">
                {['tümü', ...years].map((y) => <Opt key={y} on={yil === y} label={y} pick={() => { setYil(y); setAy('tümü'); }} />)}
              </div></div>
              <div className="frow"><span className="meta">Ay</span>
                {yil === 'tümü'
                  ? <span style={{ fontSize: 15.5, fontStyle: 'italic', color: 'var(--soft)', paddingLeft: 3 }}>önce bir yıl seç</span>
                  : <div className="opts">
                      <Opt on={ay === 'tümü'} label="tüm aylar" pick={() => setAy('tümü')} />
                      {months.map((m) => <Opt key={m} on={ay === String(m)} label={MONTHS[m - 1]} pick={() => setAy(String(m))} />)}
                    </div>}
              </div>
              <div className="frow"><span className="meta">Kategori</span><div className="opts">
                {([['hepsi', 'hepsi'], ['siir', 'şiir'], ['not', 'not'], ['defter', 'defter']] as const).map(([k, l]) =>
                  <Opt key={k} on={tur === k} label={l} pick={() => setTur(k)} />)}
              </div></div>
              <div className="frow"><span className="meta">Sıra</span><div className="opts">
                <Opt on={sort === 'desc'} label="yeniden eskiye" pick={() => { setSort('desc'); setIdx(0); }} />
                <Opt on={sort === 'asc'} label="eskiden yeniye" pick={() => { setSort('asc'); setIdx(0); }} />
              </div></div>
            </div>

            {groups.length > 0 ? groups.map((g) => (
              <section key={g.year}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 34 }}>
                  <h2 className="disp" style={{ margin: 0, fontSize: 38, fontWeight: 500, lineHeight: 1, fontVariantNumeric: 'oldstyle-nums' }}>{g.year}</h2>
                  <span aria-hidden="true" style={{ flex: 1, height: 1, background: '#CDBEA5' }} />
                </div>
                {g.months.map((m) => (
                  <div key={m.label}>
                    <h3 className="meta" style={{ margin: '24px 0 2px', color: 'var(--accent)', letterSpacing: '.26em' }}>{m.label}</h3>
                    {m.items.map((e) => (
                      <button key={e.id} type="button" className="row" onClick={() => openRead('hepsi', allSeq.first[e.id] ?? 0)}>
                        <span className="day">{ymd(e.entry_date).d}</span>
                        <span><span className="ttl">{e.title}</span><span className="sub">{CATS[e.category].one}</span></span>
                      </button>
                    ))}
                  </div>
                ))}
              </section>
            )) : (
              <div className="rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '64px 8px 0' }}>
                <span className="rule" aria-hidden="true" style={{ marginBottom: 30 }} />
                <p className="disp" style={{ margin: 0, fontSize: 31, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.15 }}>Bu raf boş.</p>
                <p style={{ margin: '14px 0 0', maxWidth: 260, fontSize: 17, lineHeight: 1.6, color: 'var(--soft)' }}>{emptyMsg} Bazı aylar sessiz geçer.</p>
                <button type="button" className="tbtn" onClick={() => { setYil('tümü'); setAy('tümü'); setTur('hepsi'); }}
                  style={{ marginTop: 20, fontSize: 16, fontStyle: 'italic', textDecoration: 'underline', textDecorationColor: 'var(--accent)', textUnderlineOffset: 5 }}>
                  filtreleri temizle
                </button>
              </div>
            )}
          </div></div>
        </main>
      )}

      {menu && (
        <nav className="menu" aria-label="Gezinme">
          <Grain id="g-menu" />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="meta" style={{ letterSpacing: '.34em', fontSize: 9.5 }}>SEPYA</span>
            <button type="button" className="tbtn" aria-label="Menüyü kapat" onClick={() => setMenu(false)}
              style={{ width: 44, marginRight: -12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" /></svg>
            </button>
          </div>
          <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '1px solid rgba(205,190,165,.55)' }}>
            {nav.map((n, i) => (
              <button key={n.label} type="button" className={'mi' + (n.on ? ' on' : '')} aria-current={n.on ? 'page' : undefined}
                onClick={n.go} style={{ animationDelay: 60 + i * 50 + 'ms' }}>
                <span className="lbl">{n.label}</span><span className="cnt">{n.count}</span>
              </button>
            ))}
          </div>
          <p style={{ position: 'relative', margin: 0, fontSize: 15, fontStyle: 'italic', color: 'var(--soft)' }}>
            {name} için · {sort === 'asc' ? 'eskiden yeniye' : 'yeniden eskiye'}
          </p>
        </nav>
      )}
    </div>
  );
}
