'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowR, Grain } from './Page';
import './reader.css';

type Stage = 'pin' | 'name' | 'welcome';

export default function Gate({ initialStage, suggestedName }: { initialStage: 'pin' | 'name'; suggestedName?: string | null }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(initialStage);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState<'' | 'a' | 'b'>('');
  const [ok, setOk] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [name, setName] = useState(suggestedName ?? '');
  const [savedName, setSavedName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const locked = lockUntil > now;
  const lockSec = Math.max(1, Math.ceil((lockUntil - now) / 1000));

  useEffect(() => {
    if (!lockUntil) return;
    const iv = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockUntil) { clearInterval(iv); setLockUntil(0); setMsg(null); setTimeout(() => inputRef.current?.focus(), 50); }
    }, 1000);
    return () => clearInterval(iv);
  }, [lockUntil]);

  async function submitPin(value: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: value }),
        credentials: 'same-origin'
      });
      const data = await res.json().catch(() => ({}));
      if (data.state === 'ok') {
        setOk(true);
        setTimeout(() => setLeaving(true), 260);
        setTimeout(() => { setStage('name'); setLeaving(false); setOk(false); setPin(''); }, 700);
        return;
      }
      setPin('');
      setShake((s) => (s === 'a' ? 'b' : 'a'));
      if (data.state === 'fail') {
        setMsg(data.left <= 2 ? `Olmadı. ${data.left} deneme kaldı.` : 'Olmadı.');
      } else if (data.state === 'wait' || data.state === 'blocked') {
        setMsg(null);
        setNow(Date.now());
        setLockUntil(Date.now() + (Number(data.retryAfter) || 30) * 1000);
      } else if (data.state === 'unset') {
        setMsg('Kapı henüz kurulmadı.');
      } else {
        setMsg('Bir şey ters gitti. Birazdan yeniden dene.');
      }
    } catch {
      setPin('');
      setMsg('Bağlantı yok gibi. Birazdan yeniden dene.');
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }

  function onPin(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(v);
    setMsg(null);
    if (v.length === 4 && !busy) setTimeout(() => submitPin(v), 160);
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/name', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n }), credentials: 'same-origin'
      });
      if (res.status === 401) { setStage('pin'); return; }
      const data = await res.json().catch(() => ({}));
      if (!data.ok) return;
      setSavedName(data.name);
      setStage('welcome');
      setTimeout(() => router.refresh(), 1500);
    } finally {
      setBusy(false);
    }
  }

  const pinsCls = 'pins' + (msg ? ' err' : '') + (ok ? ' ok' : '') + (locked ? ' locked' : '') + (shake ? ' shake-' + shake : '');

  return (
    <div className="sp">
      <Grain id="g-gate" />

      {stage === 'pin' && (
        <main className={'center ' + (leaving ? 'leaving' : 'scr')}>
          <p className="meta brandmark">SEPYA</p>
          <h1 className="disp" style={{ margin: 0, maxWidth: 260, fontSize: 32, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.15 }}>
            İçeri girmek için dört rakam.
          </h1>
          <div className={pinsCls}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={'pd' + (i < pin.length ? ' on' : '') + (i === pin.length ? ' next' : '')} aria-hidden="true" />
            ))}
            <label htmlFor="pin" className="sr">Dört haneli giriş kodu</label>
            <input
              ref={inputRef}
              id="pin"
              className="pin-in"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={onPin}
              disabled={locked || busy}
            />
          </div>
          <div className="msg" role="status" aria-live="polite">
            {msg && !locked && <p className="rise" style={{ fontSize: 18, fontStyle: 'italic', color: 'var(--accent)' }}>{msg}</p>}
            {locked && (
              <>
                <p className="rise" style={{ fontSize: 18, fontStyle: 'italic', color: 'var(--accent)' }}>Biraz bekle.</p>
                <p style={{ fontSize: 15.5, color: 'var(--soft)' }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{lockSec >= 120 ? Math.ceil(lockSec / 60) + ' dakika' : lockSec + ' saniye'}</span> sonra yeniden deneyebilirsin.
                </p>
              </>
            )}
          </div>
        </main>
      )}

      {stage === 'name' && (
        <main className="scr screen">
          <form className="nameform" onSubmit={submitName}>
            <h1 className="disp rise" style={{ margin: 0, fontSize: 44, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.05 }}>Adın ne?</h1>
            <p className="rise2" style={{ margin: '14px 0 50px', fontSize: 18, lineHeight: 1.55, color: 'var(--soft)' }}>Burada sana nasıl seslenelim?</p>
            <div className="rise2" style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
              <label htmlFor="name" className="sr">Adın</label>
              <input
                id="name"
                className="nm"
                type="text"
                placeholder="adını yaz"
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="done"
                maxLength={40}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" className="tbtn" disabled={!name.trim() || busy}
                style={{ alignSelf: 'flex-start', padding: 0, display: 'flex', alignItems: 'center', gap: 12, fontSize: 19, fontStyle: 'italic' }}>
                devam <ArrowR />
              </button>
            </div>
          </form>
        </main>
      )}

      {stage === 'welcome' && (
        <main className="scr center" style={{ gap: 22 }}>
          <span className="disp rise" style={{ fontSize: 42, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.1 }}>Hoş geldin, {savedName}.</span>
          <span className="rule rise2" aria-hidden="true" />
        </main>
      )}
    </div>
  );
}
