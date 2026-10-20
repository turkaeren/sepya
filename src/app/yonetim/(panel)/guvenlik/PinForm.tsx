'use client';

import { useActionState } from 'react';
import { changePinAction, type FormState } from '../../actions';

export default function PinForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePinAction, undefined);
  return (
    <form action={action} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
      <div className="fld" style={{ margin: 0 }}>
        <label className="lab" htmlFor="pin">Yeni okur PIN’i</label>
        <input id="pin" name="pin" className="inp mono" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" required style={{ width: 110, letterSpacing: '.4em' }} />
      </div>
      <div className="fld" style={{ margin: 0 }}>
        <label className="lab" htmlFor="pin2">Tekrar</label>
        <input id="pin2" name="pin2" className="inp mono" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" required style={{ width: 110, letterSpacing: '.4em' }} />
      </div>
      <button className="btn sm" type="submit" disabled={pending} style={{ minHeight: 42 }}>Okur PIN’ini değiştir</button>
      {state?.error && <p className="err" role="alert" style={{ width: '100%', margin: 0 }}>{state.error}</p>}
      {state?.ok && <p role="status" style={{ width: '100%', margin: 0, color: '#2F5D46', fontSize: 13.5 }}>{state.ok}</p>}
    </form>
  );
}
