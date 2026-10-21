import { requireAdmin } from '@/lib/admin-session';
import { db } from '@/lib/db';
import { logoutAction } from '../actions';
import Nav from '@/components/admin/Nav';
import '@/components/admin/admin.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'SEPYA · yönetim' };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const since = new Date(Date.now() - 86400000).toISOString();
  const [{ count: fails }, { count: notes }] = await Promise.all([
    db().from('pin_attempts').select('id', { count: 'exact', head: true }).eq('outcome', 'fail').gte('attempted_at', since),
    db().from('reader_notes').select('id', { count: 'exact', head: true }).is('read_at', null),
    db().rpc('anonymize_old_ips').then(() => null, () => null) // gizlilik: 30 günü geçen IP'leri kırp
  ]);

  return (
    <div className="ad">
      <div className="shell">
        <aside className="side">
          <div className="brand"><b>SEPYA</b><span>yönetim</span></div>
          <Nav failBadge={fails ?? 0} noteBadge={notes ?? 0} />
          <div className="sfoot">
            <a className="btn sm" href="/" target="_blank" rel="noopener" style={{ justifyContent: 'flex-start' }}>Okur tarafını aç ↗</a>
            <span style={{ overflowWrap: 'anywhere' }}>{admin.email}</span>
            <form action={logoutAction}>
              <button className="lk" type="submit" style={{ fontWeight: 400, color: '#5F5A51', fontSize: 12 }}>Çıkış yap</button>
            </form>
          </div>
        </aside>
        <main className="main"><div className="wrap">{children}</div></main>
      </div>
    </div>
  );
}
