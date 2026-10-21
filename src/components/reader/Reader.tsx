'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildSequence, sortEntries, type EntryLite, type PageData } from '@/lib/pagination';
import { MONTHS, upTR, ymd } from '@/lib/format';
import { Lock, Page } from './Page';
import PostsPanel from './PostsPanel';
import './reader.css';

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

export default function Reader({ entries, name }: { entries: EntryLite[]; name: string }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [turn, setTurn] = useState<Turn>(null);
  const [wheel, setWheel] = useState(false);
  const [dawn, setDawn] = useState(true);
  const [dusk, setDusk] = useState(false);
  const flip = useRef(false);
  const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swipedAt = useRef(0);

  // Tek sıra: yeniden eskiye
  const seq = useMemo(() => buildSequence(entries, 'hepsi', 'desc'), [entries]);
  const list = useMemo(() => sortEntries(entries, 'desc'), [entries]);
  const page = seq.pages[Math.min(idx, seq.pages.length - 1)];
  const k = page.entryId ? list.findIndex((e) => e.id === page.entryId) : -1;

  useEffect(() => { const t = setTimeout(() => setDawn(false), 1900); return () => clearTimeout(t); }, []);
  const [labelOn, setLabelOn] = useState(false);
  useEffect(() => {
    if (k < 0) return;
    setLabelOn(true);
    const t = setTimeout(() => setLabelOn(false), 2200);
    return () => clearTimeout(t);
  }, [k]);

  useEffect(() => {
    const kind = page.kind === 'cover' || page.kind === 'read' ? 'entry' : page.kind;
    track({ kind, entryId: page.entryId, part: page.part, category: page.category, label: page.title || null });
  }, [page.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') track({ kind: 'leave' }, true); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const goTo = useCallback((n: number) => {
    if (n < 0 || n >= seq.pages.length || n === idx) return;
    flip.current = !flip.current;
    setTurn({ from: seq.pages[idx], cls: (n > idx ? 'next' : 'prev') + '-' + (flip.current ? 'a' : 'b') });
    setIdx(n);
    if (turnTimer.current) clearTimeout(turnTimer.current);
    turnTimer.current = setTimeout(() => setTurn(null), 640);
  }, [idx, seq.pages]);
  const go = useCallback((d: number) => goTo(idx + d), [goTo, idx]);

  useEffect(() => {
    if (wheel) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, wheel]);

  function openWheel() {
    setWheel(true);
    track({ kind: 'menu', label: 'yazılar' });
  }

  async function lock() {
    setWheel(false);
    setDusk(true);
    track({ kind: 'leave' }, true);
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setTimeout(() => router.refresh(), 850);
  }

  const n = list.length;
  const railTop = k < 0 ? 0 : n > 1 ? (k / (n - 1)) * 100 : 50;
  const railLabel = k < 0 ? '' : (() => { const t = ymd(list[k].entry_date); return `${t.d} ${upTR(MONTHS[t.m - 1].slice(0, 3))}`; })();

  return (
    <div className="sp">
      <main className="scr screen">
        <div
          className={'stage' + (page.kind === 'read' ? ' isread' : '')}
          onPointerDown={(e) => { if ((e.target as HTMLElement).closest?.('.nbox')) { swipe.current = null; return; } swipe.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={(e) => {
            const s = swipe.current; swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x, dy = e.clientY - s.y;
            if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.3) { swipedAt.current = Date.now(); go(dx < 0 ? 1 : -1); }
          }}
        >
          <Page key={page.key} pg={page} reader={name} grainId="g-cur" hasNext={idx < seq.pages.length - 1} onNext={() => go(1)} />
          {turn && <div className={'under ' + turn.cls} aria-hidden="true" />}
          {turn && (
            <div className={'turn ' + turn.cls} aria-hidden="true">
              <Page pg={turn.from} reader={name} grainId="g-turn" />
              <div className="tshade" />
            </div>
          )}
          <button type="button" className="tbtn edge l" aria-label="Önceki sayfa" onClick={() => { if (Date.now() - swipedAt.current > 400) go(-1); }} />
          <button type="button" className="tbtn edge r" aria-label="Sonraki sayfa" onClick={() => { if (Date.now() - swipedAt.current > 400) go(1); }} />
        </div>

        {n > 0 && (
          <button type="button" className="rail" aria-label="Yazılar" onClick={openWheel}>
            <span className="line" />
            {list.map((e, i) => <span key={e.id} className="tick" style={{ top: (n > 1 ? (i / (n - 1)) * 100 : 50) + '%' }} />)}
            <span className={'cur' + (dawn ? ' hello' : '')} style={{ top: railTop + '%' }} />
            <span className={'rl' + (labelOn ? ' show' : '')} style={{ top: railTop + '%' }}>{railLabel}</span>
          </button>
        )}

        <nav className={"topnav" + (wheel ? " hid" : "")} aria-label="Gezinme">
          {n > 0 && (
            <button type="button" className="tnav tmenu" aria-haspopup="dialog" aria-expanded={wheel} onClick={openWheel}>
              <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M0 1h16M0 6h11M0 11h16" stroke="currentColor" strokeWidth="1.3" fill="none" /></svg>
              <span>Yazılar</span>
            </button>
          )}
          <span className="tsep" aria-hidden="true" />
          <button type="button" className="tnav lk" aria-label="Kilitle" onClick={lock}><Lock /></button>
        </nav>
      </main>

      {wheel && (
        <PostsPanel
          list={list}
          current={k}
          onClose={() => setWheel(false)}
          onChoose={(i) => { setWheel(false); goTo(seq.first[list[i].id] ?? 0); }}
        />
      )}

      {dawn && <div className="night" aria-hidden="true" />}
      {dusk && <div className="dusk" aria-hidden="true" />}
    </div>
  );
}
