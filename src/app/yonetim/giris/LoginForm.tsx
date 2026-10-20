'use client';

import { useActionState } from 'react';
import { loginAction, type FormState } from '../actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  return (
    <form className="card" action={action} style={{ padding: 28 }}>
      <h1 style={{ fontSize: 30 }}>Yönetici girişi</h1>
      <p className="sub" style={{ margin: '6px 0 24px' }}>Okur PIN’i bu kapıyı açmaz.</p>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <div className="fld"><label className="lab" htmlFor="email">E-posta</label><input id="email" name="email" className="inp" type="email" autoComplete="username" required /></div>
      <div className="fld"><label className="lab" htmlFor="password">Parola</label><input id="password" name="password" className="inp" type="password" autoComplete="current-password" required /></div>
      <div className="fld">
        <label className="lab" htmlFor="code">Doğrulama kodu</label>
        <input id="code" name="code" className="inp mono" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="6 haneli kod" required style={{ letterSpacing: '.3em' }} />
        <span className="hint">Kimlik doğrulayıcı uygulamandaki kod.</span>
      </div>
      <button className="btn pri full" type="submit" disabled={pending} style={{ marginTop: 6, minHeight: 44 }}>{pending ? 'Kontrol ediliyor…' : 'Giriş yap'}</button>
      <p className="hint" style={{ margin: '16px 0 0', lineHeight: 1.5 }}>Her deneme kaydedilir: zaman, IP, cihaz. 5 hatalı denemeden sonra giriş 15 dakika kilitlenir.</p>
    </form>
  );
}
