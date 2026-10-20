'use client';

import { useEffect, useRef, useState } from 'react';
import type { EntryLite } from '@/lib/pagination';
import { MONTHS, upTR, ymd } from '@/lib/format';
import { Close, Grain } from './Page';

const ITEM = 62;
const STEP = 21;
const R = Math.round(ITEM / 2 / Math.tan(((STEP / 2) * Math.PI) / 180));
const SETTLE_MS = 1100;

/**
 * Sağ kenardan açılan 3B tarih çarkı. Çevir, bırak; kısa bir bekleyişten sonra o güne götürür.
 * Bir tarihe dokunmak da doğrudan götürür. Klavye: ↑ ↓ Enter Esc.
 */
export default function DateWheel({ list, start, onChoose, onClose }: {
  list: EntryLite[]; start: number; onChoose: (k: number) => void; onClose: () => void;
}) {
  const drumRef = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const st = useRef({ pos: start, vel: 0, raf: 0, timer: 0 as unknown as ReturnType<typeof setTimeout>, last: -1, drag: null as null | { y: number; pos: number; ly: number; lt: number; moved: number; target: number | null } });
  const [sel, setSel] = useState(start);
  const [settled, setSettled] = useState(false);
  const [flash, setFlash] = useState(0);
  const [out, setOut] = useState(false);
  const max = list.length - 1;

  function close() {
    cancelAnimationFrame(st.current.raf); clearTimeout(st.current.timer);
    setOut(true);
    setTimeout(onClose, 300);
  }
  function choose(k: number) {
    cancelAnimationFrame(st.current.raf); clearTimeout(st.current.timer);
    setOut(true);
    setTimeout(() => onChoose(k), 140);
  }

  function paint() {
    const s = st.current;
    for (let i = 0; i < items.current.length; i++) {
      const el = items.current[i];
      if (!el) continue;
      const off = i - s.pos, a = off * STEP;
      if (Math.abs(a) > 100) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = 'visible';
      el.style.transform = `rotateX(${-a}deg) translateZ(${R}px)`;
      el.style.opacity = Math.max(0, 1 - Math.abs(off) * 0.2).toFixed(3);
      el.classList.toggle('on', Math.abs(off) < 0.5);
    }
    const k = Math.max(0, Math.min(max, Math.round(s.pos)));
    if (k !== s.last) {
      s.last = k;
      setSel(k);
      setFlash((f) => f + 1);
      try { navigator.vibrate?.(4); } catch { /* yok */ }
    }
  }

  function animateTo(target: number, wait: boolean) {
    const s = st.current, from = s.pos, t0 = performance.now(), dur = 380;
    cancelAnimationFrame(s.raf);
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      s.pos = from + (target - from) * e; paint();
      if (p < 1) s.raf = requestAnimationFrame(step);
      else if (wait) { setSettled(true); s.timer = setTimeout(() => choose(target), SETTLE_MS); }
    };
    step();
  }
  const snap = () => animateTo(Math.max(0, Math.min(max, Math.round(st.current.pos))), true);
  const rubber = (v: number) => (v < 0 ? -Math.pow(-v, 0.6) * 0.5 : v > max ? max + Math.pow(v - max, 0.6) * 0.5 : v);

  useEffect(() => {
    paint();
    const drum = drumRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = st.current;
      cancelAnimationFrame(s.raf); clearTimeout(s.timer); setSettled(false);
      s.pos = Math.max(0, Math.min(max, s.pos + (e.deltaY / ITEM) * 0.5));
      paint();
      s.timer = setTimeout(snap, 140);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); clearTimeout(st.current.timer); setSettled(false);
        animateTo(Math.max(0, Math.min(max, Math.round(st.current.pos) + (e.key === 'ArrowDown' ? 1 : -1))), true);
      }
      if (e.key === 'Enter') choose(Math.round(st.current.pos));
    };
    drum.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKey);
    return () => {
      drum.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(st.current.raf); clearTimeout(st.current.timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    const s = st.current;
    cancelAnimationFrame(s.raf); clearTimeout(s.timer); setSettled(false);
    const t = (e.target as HTMLElement).closest('.it');
    s.drag = { y: e.clientY, pos: s.pos, ly: e.clientY, lt: performance.now(), moved: 0, target: t ? Number(t.getAttribute('data-i')) : null };
    s.vel = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = st.current, d = s.drag;
    if (!d) return;
    const now = performance.now(), dt = Math.max(1, now - d.lt);
    d.moved = Math.max(d.moved, Math.abs(e.clientY - d.y));
    s.pos = rubber(d.pos - (e.clientY - d.y) / ITEM);
    s.vel = 0.8 * ((d.ly - e.clientY) / ITEM / dt) + 0.2 * s.vel;
    d.ly = e.clientY; d.lt = now;
    paint();
  }
  function onUp() {
    const s = st.current, d = s.drag;
    if (!d) return;
    s.drag = null;
    if (d.moved < 6 && d.target != null) return choose(d.target);
    if (performance.now() - d.lt > 80) s.vel = 0;
    let last = performance.now();
    const inertia = () => {
      const now = performance.now(), dt = now - last; last = now;
      s.pos += s.vel * dt;
      s.vel *= Math.pow(0.94, dt / 16);
      if (s.pos < 0 || s.pos > max) s.vel *= 0.6;
      paint();
      if (Math.abs(s.vel) > 0.0015) s.raf = requestAnimationFrame(inertia);
      else snap();
    };
    inertia();
  }

  const e = list[sel];
  const t = ymd(e.entry_date);

  return (
    <div className={'wheel' + (out ? ' out' : '') + (settled ? ' settled' : '')} role="dialog" aria-label="Tarih seç">
      <div className="veil" onClick={close} />
      <Grain id="g-wheel" />
      <div className="whead">
        <span className="meta">tarihler</span>
        <button type="button" className="tbtn wclose" aria-label="Kapat" onClick={close}><Close /></button>
      </div>
      <div className={'sel' + (flash ? ' flash' : '')} key={flash}>
        <span className="meta">{t.d} {upTR(MONTHS[t.m - 1])} {t.y}</span>
        <span className="disp ttl">{e.title}</span>
        <span className="go">bırak, götüreyim</span>
      </div>
      <div className="drum" ref={drumRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="band" />
        <div className="cyl">
          {list.map((x, i) => {
            const d = ymd(x.entry_date);
            return (
              <button key={x.id} type="button" className="it" data-i={i} tabIndex={-1} ref={(el) => { items.current[i] = el; }} aria-label={`${d.d} ${MONTHS[d.m - 1]} ${d.y}, ${x.title}`}>
                <span className="m"><span>{upTR(MONTHS[d.m - 1].slice(0, 3))}</span><span>{d.y}</span></span>
                <span className="d">{d.d}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="wfoot meta">{list.length} sayfa · yeniden eskiye</div>
      <div className="sr" aria-live="polite">{t.d} {MONTHS[t.m - 1]} {t.y}, {e.title}</div>
    </div>
  );
}
