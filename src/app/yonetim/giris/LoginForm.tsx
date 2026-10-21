'use client';

import { useActionState, useEffect, useState } from 'react';
import { loginAction, type FormState } from '../actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  const [remember, setRemember] = useState(false);
  // Ana ekrandaki uygulamadan açıldıysa varsayılan olarak açık kalsın
  useEffect(() => { if (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone) setRemember(true); }, []);
  return (
    <form className="card" action={action} style={{ padding: 28 }}>
      <h1 style={{ fontSize: 30 }}>Yönetici girişi</h1>
      <p className="sub" style={{ margin: '6px 0 24px' }}>Okur PIN’i bu kapıyı açmaz.</p>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <div className="fld"><label className="lab" htmlFor="email">E-posta</label><input id="email" name="email" className="inp" type="email" autoComplete="username" required /></div>
      <div className="fld"><label className="lab" htmlFor="password">Parola</label><input id="password" name="password" className="inp" type="password" autoComplete="current-password" required /></div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '2px 0 14px', fontSize: 14 }}>
        <input type="checkbox" name="remember" value="1" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 18, height: 18 }} />
        <span>Bu cihazda açık kalsın <span className="mu">(30 gün)</span></span>
      </label>
      <button className="btn pri full" type="submit" disabled={pending} style={{ marginTop: 6, minHeight: 44 }}>{pending ? 'Kontrol ediliyor…' : 'Giriş yap'}</button>
      <p className="hint" style={{ margin: '16px 0 0', lineHeight: 1.5 }}>Her deneme kaydedilir: zaman, IP, cihaz. Aynı yerden 5 hatalı denemede 15 dakika, hesaba saatte 10 hatalı denemede 1 saat kilit.</p>
    </form>
  );
}
