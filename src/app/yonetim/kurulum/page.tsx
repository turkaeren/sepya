import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { hasAnyAdmin, newTotpSecret, totpUri } from '@/lib/admin-session';
import SetupForm from './SetupForm';
import '@/components/admin/admin.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'SEPYA · kurulum' };

/**
 * İlk kurulum: yalnızca hiç yönetici yokken açılır ve sunucudaki SETUP_TOKEN olmadan hesap oluşturmaz.
 * Burada üretilen doğrulama anahtarı, kurulum tamamlanana kadar hiçbir şeyi açmaz.
 */
export default async function Page() {
  if (await hasAnyAdmin()) notFound();
  const secret = newTotpSecret();
  const qr = await QRCode.toDataURL(totpUri(secret, 'SEPYA yönetici'), { margin: 1, width: 360, color: { dark: '#1B1A17', light: '#FFFFFF' } });

  return (
    <div className="ad">
      <div className="login">
        <div className="lbox" style={{ maxWidth: 460 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 600, letterSpacing: '.24em', paddingLeft: '.24em' }}>SEPYA</div>
            <div className="mu" style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginTop: 6 }}>ilk kurulum</div>
          </div>
          <SetupForm secret={secret} qr={qr} />
        </div>
      </div>
    </div>
  );
}
