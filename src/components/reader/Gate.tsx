'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowR, Grain } from './Page';
import { checkName } from '@/lib/name';
import './reader.css';

type Stage = 'name' | 'pin' | 'welcome';

/**
 * Kapı: önce isim, sonra şifre. Şifre isimle birlikte gönderilir; yanlış denemeler yönetimde isimle görünür.
 * `hasSession`: şifresi doğru ama ismi olmayan eski oturumlar için isim doğrudan kaydedilir.
 */
export default function Gate({ suggestedName, hasSession = false }: { suggestedName?: string | null; hasSession?: boolean }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('name');
  const [name, setName] = useState(suggestedName ?? '');
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [cleanName, setCleanName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState<'' | 'a' | 'b'>('');
  const [ok, setOk] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // Nereden gelindi: ilk açılıştaki yönlendiren sayfa ve bağlantı etiketleri
  const origin = useRef({ ref: '', qs: '' });
  useEffect(() => {
    let o = { ref: document.referrer || '', qs: window.location.search || '' };
    try {
      const saved = sessionStorage.getItem('sepya_src');
      if (saved && !o.ref && !o.qs) o = JSON.parse(saved);
      else sessionStorage.setItem('sepya_src', JSON.stringify(o));
    } catch { /* depolama kapalı olabilir */ }
    origin.current = o;
  }, []);

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

  function welcome(n: string) {
    setCleanName(n);
    setStage('welcome');
    setTimeout(() => router.refresh(), 2300);
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const nc = checkName(name);
    if (!nc.ok) { setNameErr(nc.reason); setShake((s) => (s === 'a' ? 'b' : 'a')); nameRef.current?.focus(); return; }
    setNameErr(null);
    setName(nc.name);
    setCleanName(nc.name);

    if (hasSession) {
      setBusy(true);
      try {
        const res = await fetch('/api/name', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: nc.name }), credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) { window.location.reload(); return; }
        if (!data.ok) { setNameErr(data.reason ?? 'Bu bir isim gibi durmuyor.'); return; }
        welcome(data.name);
      } finally { setBusy(false); }
      return;
    }

    setLeaving(true);
    setTimeout(() => { setStage('pin'); setLeaving(false); }, 420);
  }

  async function submitPin(value: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: value, name: cleanName, ref: origin.current.ref, qs: origin.current.qs }),
        credentials: 'same-origin'
      });
      const data = await res.json().catch(() => ({}));
      if (data.state === 'ok') {
        setOk(true);
        setTimeout(() => setLeaving(true), 260);
        setTimeout(() => { setLeaving(false); welcome(data.name ?? cleanName); }, 700);
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
      } else if (data.state === 'badname') {
        setNameErr(data.reason ?? 'Bu bir isim gibi durmuyor.');
        setStage('name');
        return;
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

  const pinsCls = 'pins' + (msg ? ' err' : '') + (ok ? ' ok' : '') + (locked ? ' locked' : '') + (shake ? ' shake-' + shake : '');

  return (
    <div className="sp dark">
      <div className="glow" aria-hidden="true" />
      <Grain id="g-gate" />

      {stage === 'name' && (
        <main className={'screen ' + (leaving ? 'leaving' : 'scr')}>
          <form className="nameform" onSubmit={submitName} noValidate>
            <h1 className="disp reveal" style={{ margin: '0 0 50px', fontSize: 44, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.05 }}>Adın ne?</h1>
            <div className={'reveal3' + (nameErr && shake ? ' shake-' + shake : '')} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label htmlFor="name" className="sr">Adın</label>
              <input
                ref={nameRef}
                id="name"
                className={'nm' + (nameErr ? ' bad' : '')}
                type="text"
                placeholder="adını yaz"
                autoComplete="given-name"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                maxLength={30}
                autoFocus
                aria-invalid={!!nameErr}
                aria-describedby="name-err"
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameErr) setNameErr(null); }}
              />
              <p id="name-err" role="status" aria-live="polite" className="nerr">{nameErr ?? ''}</p>
              <button type="submit" className="tbtn" disabled={!name.trim() || busy}
                style={{ alignSelf: 'flex-start', padding: 0, marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, fontSize: 19, fontStyle: 'italic' }}>
                devam <ArrowR />
              </button>
            </div>
          </form>
        </main>
      )}

      {stage === 'pin' && (
        <main className={'center ' + (leaving ? 'leaving' : 'scr')}>
          <p className="meta brandmark reveal3">SEPYA</p>
          <h1 className="disp reveal" style={{ margin: 0, maxWidth: 260, fontSize: 32, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.15 }}>
            Şifre?
          </h1>
          <div className="reveal3">
            <div className={pinsCls}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={'pd' + (i < pin.length ? ' on' : '') + (i === pin.length ? ' next' : '')} aria-hidden="true" />
              ))}
              <label htmlFor="pin" className="sr">Dört haneli şifre</label>
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
          <button type="button" className="tbtn whoami reveal3" onClick={() => { setStage('name'); setPin(''); setMsg(null); }}>
            {cleanName} değil misin?
          </button>
        </main>
      )}

      {stage === 'welcome' && (
        <main className="scr center" style={{ gap: 22 }}>
          <span className="disp reveal" style={{ fontSize: 42, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.1 }}>Hoş geldin, {cleanName}.</span>
          <span className="rule reveal2" aria-hidden="true" />
        </main>
      )}
    </div>
  );
}
