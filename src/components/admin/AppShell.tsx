'use client';

import { useEffect, useState } from 'react';

/** Service worker'ı kaydeder (yalnızca /yonetim kapsamında). */
export function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/yonetim-sw.js', { scope: '/yonetim' }).catch(() => {});
  }, []);
  return null;
}

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Uygulamayı yükle": Android'de kurulum penceresi, iPhone'da adımlar. Zaten uygulamadaysa görünmez. */
export function InstallApp() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sa = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(sa);
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    const on = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    const ok = () => setDone(true);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', ok);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', ok); };
  }, []);

  if (standalone) return null;
  if (done) return <div className="okbar" role="status">Uygulama yüklendi. Ana ekrandaki SEPYA simgesinden açabilirsin.</div>;

  return (
    <section className="card install">
      <img src="/app/icon-192.png" alt="" width={52} height={52} />
      <div>
        <b>Yönetimi uygulama olarak kur</b>
        {evt ? (
          <p>Ana ekranına SEPYA simgesi eklenir; tam ekran açılır, giriş açık kalır.</p>
        ) : ios ? (
          <p>Safari’de alttaki <b>Paylaş</b> düğmesine dokun → <b>Ana Ekrana Ekle</b>.</p>
        ) : (
          <p>Chrome menüsünden (⋮) <b>Uygulamayı yükle</b> ya da <b>Ana ekrana ekle</b>’yi seç.</p>
        )}
      </div>
      {evt && <button type="button" className="btn pri" onClick={async () => { await evt.prompt(); const r = await evt.userChoice; if (r.outcome === 'accepted') setDone(true); setEvt(null); }}>Kur</button>}
    </section>
  );
}
