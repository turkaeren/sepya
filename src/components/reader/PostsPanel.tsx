'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EntryLite } from '@/lib/pagination';
import { MONTHS, upTR, ymd } from '@/lib/format';
import { Close, Grain } from './Page';

function excerpt(e: EntryLite) {
  const text = e.content.replace(/\r/g, '').trim();
  if (e.category === 'siir') {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !/^[IVX]+\.$/.test(l));
    return lines.slice(0, 2).join(' / ');
  }
  const first = text.split(/\n\s*\n/)[0].replace(/\s+/g, ' ');
  const sentence = first.match(/^.+?[.!?…](\s|$)/)?.[0] ?? first;
  return sentence.length > 140 ? sentence.slice(0, 137).trimEnd() + '…' : sentence.trim();
}

function readTime(e: EntryLite) {
  const words = e.content.split(/\s+/).filter(Boolean).length;
  const s = Math.max(10, Math.round(words / 3.2));
  return s < 60 ? `${Math.round(s / 5) * 5} sn` : `${Math.round(s / 60)} dk`;
}

/**
 * Sağdan açılan yazılar paneli: yeniden eskiye, ay ay gruplu.
 * Okunan yazı işaretlidir; açılınca oraya kayar. Esc ya da dışarı dokunmak kapatır.
 */
export default function PostsPanel({ list, current, onChoose, onClose }: {
  list: EntryLite[]; current: number; onChoose: (k: number) => void; onClose: () => void;
}) {
  const [out, setOut] = useState(false);
  const curRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo(() => {
    const g: { key: string; label: string; items: { e: EntryLite; i: number }[] }[] = [];
    list.forEach((e, i) => {
      const t = ymd(e.entry_date);
      const key = `${t.y}-${t.m}`;
      let last = g[g.length - 1];
      if (!last || last.key !== key) { last = { key, label: `${upTR(MONTHS[t.m - 1])} ${t.y}`, items: [] }; g.push(last); }
      last.items.push({ e, i });
    });
    return g;
  }, [list]);

  function close() { setOut(true); setTimeout(onClose, 260); }
  function choose(i: number) { setOut(true); setTimeout(() => onChoose(i), 180); }

  useEffect(() => {
    curRef.current?.scrollIntoView({ block: 'center' });
    (curRef.current ?? closeRef.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={'posts' + (out ? ' out' : '')} role="dialog" aria-modal="true" aria-label="Yazılar">
      <div className="veil" onClick={close} />
      <aside className="panel">
        <Grain id="g-posts" />
        <div className="phead">
          <div>
            <span className="meta">yazılar</span>
            <span className="pcount">{list.length} yazı · yeniden eskiye</span>
          </div>
          <button ref={closeRef} type="button" className="tbtn pclose" aria-label="Kapat" onClick={close}><Close /></button>
        </div>
        <div className="plist">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="pmonth">{g.label}</h3>
              {g.items.map(({ e, i }) => {
                const t = ymd(e.entry_date);
                const on = i === current;
                return (
                  <button key={e.id} ref={on ? curRef : undefined} type="button" className={'pitem' + (on ? ' on' : '')}
                    aria-current={on ? 'true' : undefined} onClick={() => choose(i)}>
                    <span className="pday">{t.d}</span>
                    <span className="pcol">
                      <span className="pttl">{e.title}</span>
                      <span className="pex">{excerpt(e)}</span>
                      <span className="pmeta">{on ? 'okuyorsun · ' : ''}{readTime(e)}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
