'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { importAction, type ImportState } from '../../../actions';

export default function ImportForm({ existing }: { existing: number }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, undefined);
  const [mode, setMode] = useState<'url' | 'file'>('url');

  if (state?.ok) {
    return (
      <section className="card">
        <div className="okbar" role="status">{state.ok}</div>
        <ul className="rules" style={{ marginBottom: 16 }}>
          <li><span>Aktarılan yazı</span><span className="mono">{state.count}</span></li>
          <li><span>Şiir olarak (satır düzeni korunur)</span><span className="mono">{state.siir}</span></li>
          <li><span>Düzyazı olarak</span><span className="mono">{state.not}</span></li>
          <li><span>Silinen eski içerik</span><span className="mono">{state.deleted}</span></li>
        </ul>
        <div className="acts"><Link className="btn pri" href="/yonetim/icerikler">İçeriklere git</Link><a className="btn" href="/" target="_blank" rel="noopener">Okur tarafında bak ↗</a></div>
      </section>
    );
  }

  return (
    <form className="card" action={action} style={{ maxWidth: 720 }}>
      {state?.error && <div className="alertbar" role="alert">{state.error}</div>}
      <input type="hidden" name="mode" value={mode} />

      <div className="fld">
        <span className="lab">Kaynak</span>
        <div className="tabs" role="group" aria-label="Kaynak" style={{ alignSelf: 'flex-start' }}>
          <button type="button" className={'tab' + (mode === 'url' ? ' on' : '')} aria-pressed={mode === 'url'} onClick={() => setMode('url')}>WordPress.com adresi</button>
          <button type="button" className={'tab' + (mode === 'file' ? ' on' : '')} aria-pressed={mode === 'file'} onClick={() => setMode('file')}>Dışa aktarma dosyası (.xml)</button>
        </div>
      </div>

      {mode === 'url' ? (
        <div className="fld">
          <label className="lab" htmlFor="site">Blog adresi</label>
          <input id="site" name="site" className="inp" defaultValue="yirmibesincisaat.wordpress.com" required />
          <span className="hint">Blog herkese açıksa doğrudan çalışır. Gizliyse “Dışa aktarma dosyası”nı seç.</span>
        </div>
      ) : (
        <div className="fld">
          <label className="lab" htmlFor="file">WordPress dışa aktarma dosyası</label>
          <input id="file" name="file" className="inp" type="file" accept=".xml,application/xml,text/xml" required />
          <span className="hint">WordPress panelinde: <b>Araçlar → Dışa Aktar → Tüm içerik → Dışa aktarma dosyasını indir</b>. İnen .zip ise içindeki .xml dosyasını seç.</span>
        </div>
      )}

      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '6px 0 18px', fontSize: 14 }}>
        <input type="checkbox" name="replace" value="1" defaultChecked style={{ marginTop: 3 }} />
        <span>Önce mevcut <b>{existing}</b> içeriği sil. Silme yalnızca aktarma başarılı olursa yapılır; okuma kayıtları silinmez.</span>
      </label>

      <button className="btn pri" type="submit" disabled={pending}>{pending ? 'Aktarılıyor…' : 'İçe aktar'}</button>
    </form>
  );
}
