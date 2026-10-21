'use client';

import { useEffect, useRef, useState } from 'react';
import { Close, Grain } from './Page';

const MAX = 2000;

/**
 * Okurun yazara bıraktığı not. Aşağıdan açılan kâğıt bir yaprak; yalnızca yönetim panelinde görünür.
 */
export default function NoteSheet({ name, entry, onClose }: {
  name: string; entry: { id: string; title: string } | null; onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [about, setAbout] = useState(!!entry);
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { const t = setTimeout(() => ta.current?.focus(), 380); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function close() { setOut(true); setTimeout(onClose, 260); }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) { setErr('Bir şey yaz.'); return; }
    setState('busy'); setErr(null);
    try {
      const res = await fetch('/api/note', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body, entryId: about && entry ? entry.id : null })
      });
      if (res.status === 401) { window.location.reload(); return; }
      if (res.status === 429) { setErr('Biraz fazla not oldu. Sonra yine yaz.'); setState('idle'); return; }
      if (!res.ok) { setErr('Ulaşmadı. Bir daha dene.'); setState('idle'); return; }
      setState('sent');
      setTimeout(close, 2200);
    } catch {
      setErr('Bağlantı yok gibi. Bir daha dene.'); setState('idle');
    }
  }

  return (
    <div className={'notes' + (out ? ' out' : '')} role="dialog" aria-modal="true" aria-label="Not bırak">
      <div className="veil" onClick={close} />
      <form className="sheet" onSubmit={send}>
        <Grain id="g-note" />
        <div className="nhead">
          <span className="meta">yalnızca yazar görür</span>
          <button type="button" className="nclose" aria-label="Kapat" onClick={close}><Close /></button>
        </div>

        {state === 'sent' ? (
          <div className="nsent" role="status">
            <p className="disp">Bıraktın.</p>
            <p>Notun yerine ulaştı, {name}.</p>
          </div>
        ) : (
          <>
            <h2 className="disp ntitle">Bir not bırak</h2>
            {entry && (
              <label className="nabout">
                <input type="checkbox" checked={about} onChange={(e) => setAbout(e.target.checked)} />
                <span>“{entry.title}” hakkında</span>
              </label>
            )}
            <textarea
              ref={ta}
              className="nta"
              value={text}
              maxLength={MAX}
              rows={6}
              placeholder="Buraya yaz…"
              onChange={(e) => { setText(e.target.value); if (err) setErr(null); }}
              aria-label="Not"
            />
            <div className="nfoot">
              <span className="nerr2" role="alert">{err ?? (text.length > MAX - 200 ? `${MAX - text.length} harf kaldı` : '')}</span>
              <span className="nsign">— {name}</span>
            </div>
            <button type="submit" className="nsend" disabled={state === 'busy' || !text.trim()}>
              {state === 'busy' ? 'Bırakılıyor…' : 'Bırak'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
