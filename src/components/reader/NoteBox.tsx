'use client';

import { useRef, useState } from 'react';

type Phase = 'idle' | 'open' | 'sending' | 'sent';

/** Yazının sonunda, okurun yazar için kısa bir not bırakabildiği sessiz bir alan. */
export default function NoteBox({ entryId }: { entryId: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  function open() {
    setPhase('open');
    setErr('');
    setTimeout(() => {
      area.current?.focus({ preventScroll: true });
      box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  }

  async function send() {
    const t = text.trim();
    if (!t) { setErr('Önce bir şeyler yaz.'); return; }
    setPhase('sending');
    setErr('');
    try {
      const r = await fetch('/api/note', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ entryId, text: t })
      });
      if (r.status === 401) { window.location.reload(); return; }
      if (r.status === 429) { setErr('Çok not gönderdin, biraz sonra tekrar dene.'); setPhase('open'); return; }
      if (!r.ok) { setErr('Not gönderilemedi. Bir daha dene.'); setPhase('open'); return; }
      setText('');
      setPhase('sent');
    } catch {
      setErr('Bağlantı kurulamadı. Bir daha dene.');
      setPhase('open');
    }
  }

  return (
    <div className="nbox" ref={box}>
      {phase === 'idle' && (
        <button type="button" className="nopen" onClick={open}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M2 14l1-3.6L11.4 2a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2L5.6 13 2 14zM10 3.4l2.6 2.6" /></svg>
          bu yazıya bir not bırak
        </button>
      )}

      {(phase === 'open' || phase === 'sending') && (
        <div className="nform">
          <label className="nlab" htmlFor={'nt-' + entryId}>Yazara not</label>
          <textarea
            id={'nt-' + entryId}
            ref={area}
            className="nta"
            rows={4}
            maxLength={1000}
            value={text}
            disabled={phase === 'sending'}
            placeholder="Aklından geçeni yaz…"
            onChange={(e) => setText(e.target.value)}
          />
          <div className="nfoot">
            <span className="ncount" aria-live="polite">{text.length > 800 ? `${1000 - text.length} karakter kaldı` : ''}</span>
            <button type="button" className="nbtn2" onClick={() => { setPhase('idle'); setErr(''); }} disabled={phase === 'sending'}>vazgeç</button>
            <button type="button" className="nbtn2 go" onClick={send} disabled={phase === 'sending' || !text.trim()}>{phase === 'sending' ? 'gönderiliyor…' : 'bırak'}</button>
          </div>
          {err && <p className="nerr2" role="alert">{err}</p>}
        </div>
      )}

      {phase === 'sent' && (
        <p className="nsent" role="status">
          Notun bırakıldı.{' '}
          <button type="button" className="nopen inline" onClick={open}>bir not daha</button>
        </p>
      )}
    </div>
  );
}
