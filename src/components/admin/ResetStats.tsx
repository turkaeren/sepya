'use client';

import { useActionState } from 'react';
import { resetStatsAction, type FormState } from '@/app/yonetim/actions';

export default function ResetStats() {
  const [state, action, pending] = useActionState<FormState, FormData>(resetStatsAction, undefined);
  return (
    <details className="card reset" open={!!state?.error}>
      <summary>İstatistikleri sıfırla</summary>
      <form action={action} className="rbody">
        {state?.error && <div className="alertbar" role="alert">{state.error}</div>}
        {state?.ok && <div className="okbar" role="status">{state.ok}</div>}
        <label className="chk"><input type="checkbox" name="views" value="1" defaultChecked /> <span><b>Ziyaret ve okuma istatistikleri</b>: ziyaretçiler, oturumlar, sayfa görüntülemeleri, okuma süreleri, kaynaklar. Şu an içeride olan okurlar atılmaz.</span></label>
        <label className="chk"><input type="checkbox" name="fails" value="1" defaultChecked /> <span><b>Giriş denemeleri</b>: başarılı/başarısız PIN denemeleri ve IP engelleri.</span></label>
        <p className="hint" style={{ margin: '4px 0 10px' }}>İçerikler, notlar, kapak ve PIN silinmez. Bu işlem geri alınamaz.</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input name="confirm" className="inp" placeholder="onay için: sıfırla" autoComplete="off" style={{ maxWidth: 200 }} />
          <button className="btn danger" type="submit" disabled={pending}>{pending ? 'Sıfırlanıyor…' : 'Sıfırla'}</button>
        </div>
      </form>
    </details>
  );
}
