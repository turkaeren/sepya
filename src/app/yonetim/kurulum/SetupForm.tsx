'use client';

import { useActionState } from 'react';
import { setupAction, type FormState } from '../actions';

export default function SetupForm({ secret, qr }: { secret: string; qr: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setupAction, undefined);
  return (
    <form className="card" action={action} style={{ padding: 28 }}>
      <h1 style={{ fontSize: 30 }}>Kapıyı kur</h1>
      <p className="sub" style={{ margin: '6px 0 22px' }}>Bir kez yapılır. Yönetici hesabı oluşunca bu sayfa kapanır.</p>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <input type="hidden" name="secret" value={secret} />

      <div className="fld"><label className="lab" htmlFor="token">Kurulum anahtarı (SETUP_TOKEN)</label><input id="token" name="token" className="inp mono" type="password" autoComplete="off" required /></div>
      <div className="fld"><label className="lab" htmlFor="email">Yönetici e-postası</label><input id="email" name="email" className="inp" type="email" autoComplete="username" required /></div>
      <div className="row2">
        <div className="fld"><label className="lab" htmlFor="password">Parola (en az 12)</label><input id="password" name="password" className="inp" type="password" autoComplete="new-password" minLength={12} required /></div>
        <div className="fld"><label className="lab" htmlFor="password2">Parola tekrar</label><input id="password2" name="password2" className="inp" type="password" autoComplete="new-password" minLength={12} required /></div>
      </div>

      <div className="fld">
        <span className="lab">İki adımlı doğrulama</span>
        <span className="hint">Google Authenticator, 1Password ya da benzeri bir uygulamayla kodu tara.</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="qr" src={qr} alt="Doğrulama uygulaması için QR kodu" />
        <span className="hint">Tarayamıyorsan bu anahtarı elle gir:</span>
        <span className="secret">{secret}</span>
      </div>
      <div className="fld"><label className="lab" htmlFor="code">Uygulamadaki 6 haneli kod</label><input id="code" name="code" className="inp mono" inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="one-time-code" required style={{ letterSpacing: '.3em' }} /></div>

      <div className="fld">
        <label className="lab" htmlFor="pin">Okurların gireceği 4 haneli PIN</label>
        <input id="pin" name="pin" className="inp mono" type="password" inputMode="numeric" maxLength={4} pattern="\d{4}" autoComplete="off" required style={{ letterSpacing: '.4em', maxWidth: 160 }} />
        <span className="hint">Yalnızca argon2id özeti saklanır. Sonradan Güvenlik ekranından değiştirebilirsin.</span>
      </div>

      <button className="btn pri full" type="submit" disabled={pending} style={{ minHeight: 44 }}>{pending ? 'Kuruluyor…' : 'Kur ve gir'}</button>
    </form>
  );
}
