import { redirect } from 'next/navigation';
import { getAdmin, hasAnyAdmin } from '@/lib/admin-session';
import { db } from '@/lib/db';
import { dotsDT } from '@/lib/format';
import LoginForm from './LoginForm';
import '@/components/admin/admin.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'SEPYA · yönetim' };

export default async function Page() {
  if (await getAdmin()) redirect('/yonetim');
  if (!(await hasAnyAdmin())) redirect('/yonetim/kurulum');
  const { data: last } = await db().from('admin_login_events').select('at, city, device, browser')
    .eq('success', true).order('at', { ascending: false }).limit(1).maybeSingle();

  return (
    <div className="ad">
      <div className="login">
        <div className="lbox">
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 600, letterSpacing: '.24em', paddingLeft: '.24em' }}>SEPYA</div>
            <div className="mu" style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginTop: 6 }}>yönetim</div>
          </div>
          <LoginForm />
          {last && (
            <p className="hint" style={{ textAlign: 'center', marginTop: 16 }}>
              Son başarılı giriş: {dotsDT(last.at)}{last.city ? ' · ' + last.city : ''}{last.device ? ' · ' + last.device + ' / ' + last.browser : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
