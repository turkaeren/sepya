import Link from 'next/link';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/admin-session';
import { InstallApp } from '@/components/admin/AppShell';
import { logoutAction } from '../../actions';

export const dynamic = 'force-dynamic';

const LINKS: [string, string, string][] = [
  ['/yonetim/analitik', 'Analitik', 'ziyaretler, kaynaklar, okuma saatleri'],
  ['/yonetim/ziyaretciler', 'Ziyaretçiler', 'kim, ne zaman, ne okudu'],
  ['/yonetim/basarisiz', 'Başarısız denemeler', 'yanlış şifre girenler, IP engelleri'],
  ['/yonetim/kapak', 'Kapak', 'açılış sayfasındaki yazılar'],
  ['/yonetim/guvenlik', 'Güvenlik', 'şifre, oturumlar']
];

export default async function Daha() {
  const admin = await getAdmin();
  const { count: fails } = await db().from('pin_attempts').select('id', { count: 'exact', head: true })
    .eq('outcome', 'fail').gte('attempted_at', new Date(Date.now() - 86400000).toISOString());
  return (
    <div>
      <div className="ph"><div><h1>Daha</h1><p className="sub">{admin?.email}</p></div></div>
      <InstallApp />
      <section className="card flush menu">
        {LINKS.map(([href, label, sub]) => (
          <Link key={href} href={href} className="mrow">
            <span><b>{label}</b><small>{sub}</small></span>
            {href === '/yonetim/basarisiz' && (fails ?? 0) > 0 ? <span className="badge">{fails}</span> : <span className="chev" aria-hidden="true">›</span>}
          </Link>
        ))}
        <a href="/" target="_blank" rel="noopener" className="mrow"><span><b>Okur tarafını aç</b><small>sepya.blog</small></span><span className="chev" aria-hidden="true">↗</span></a>
      </section>
      <form action={logoutAction} style={{ marginTop: 16 }}>
        <button className="btn full" type="submit">Çıkış yap</button>
      </form>
    </div>
  );
}
