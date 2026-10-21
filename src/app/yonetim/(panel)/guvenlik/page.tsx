import { db } from '@/lib/db';
import { requireAdmin, ADMIN_RULES } from '@/lib/admin-session';
import { PIN_RULES, pinInfo } from '@/lib/pin';
import { dotsDT, hm } from '@/lib/format';
import { Status } from '@/components/admin/Charts';
import { endAdminSessionAction, revokeAllAction, revokeSessionAction } from '../../actions';
import PinForm from './PinForm';

export const dynamic = 'force-dynamic';

export default async function Guvenlik() {
  const me = await requireAdmin();
  const sb = db();
  const [active, logins, adminSessions, pin] = await Promise.all([
    sb.from('v_sessions').select('id, name, device, browser, ip, created_at, last_seen_at, status').eq('status', 'active').order('last_seen_at', { ascending: false }).limit(50),
    sb.from('admin_login_events').select('id, at, success, reason, ip, country, city, device, browser').order('at', { ascending: false }).limit(30),
    sb.from('admin_sessions').select('id, ip, device, browser, created_at, last_seen_at, expires_at, ended_at').is('ended_at', null).gt('expires_at', new Date().toISOString()).order('last_seen_at', { ascending: false }),
    pinInfo()
  ]);
  const act = active.data ?? [];

  return (
    <div>
      <div className="ph">
        <div><h1>Güvenlik</h1><p className="sub">Oturumlar, yönetici girişleri ve koruma kuralları.</p></div>
        <div className="acts">
          <form action={revokeAllAction}><button className="btn dan" type="submit" disabled={!act.length}>Tüm okur oturumlarını sonlandır</button></form>
        </div>
      </div>

      <div className="g2" style={{ marginTop: 0 }}>
        <section className="card flush">
          <div className="ct"><h2>Açık okur oturumları</h2><span className="x">{act.length} aktif</span></div>
          {act.length === 0 ? <p className="hint" style={{ padding: '0 20px 18px', margin: 0 }}>Şu anda açık oturum yok.</p> : (
            <div className="tbw">
              <table className="tb">
                <thead><tr><th>İsim</th><th>Cihaz</th><th>IP</th><th>Başladı</th><th>Son hareket</th><th /></tr></thead>
                <tbody>
                  {act.map((s) => (
                    <tr key={s.id}>
                      <td><Status s="active" /> {s.name ?? 'isimsiz'}</td><td>{s.device} / {s.browser}</td><td className="mono">{s.ip ?? '—'}</td>
                      <td className="mono">{hm(s.created_at)}</td><td className="mono">{hm(s.last_seen_at)}</td>
                      <td className="r"><form action={revokeSessionAction}><input type="hidden" name="id" value={s.id} /><button className="btn sm dan" type="submit">Sonlandır</button></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="ct"><h2>Koruma kuralları</h2><span className="x">sunucu tarafında</span></div>
          <ul className="rules">
            <li><span>{PIN_RULES.waitEvery} ardışık hatalı PIN</span><span className="mono">{PIN_RULES.waitSeconds} sn bekleme</span></li>
            <li><span>{PIN_RULES.burstLimit} hata / {PIN_RULES.burstWindowMin} dk, aynı IP</span><span className="mono">IP {PIN_RULES.burstBlockMin} dk engel</span></li>
            <li><span>{PIN_RULES.dailyLimit} hata / gün, aynı IP</span><span className="mono">{PIN_RULES.dailyBlockHours} sa engel</span></li>
            <li><span>{PIN_RULES.globalLimit} hata / {PIN_RULES.burstWindowMin} dk, tüm IP’ler</span><span className="mono">herkese {PIN_RULES.globalWaitSeconds} sn bekleme</span></li>
            <li><span>Okur PIN’i</span><span className="mono">argon2id özeti</span></li>
            <li><span>Oturum çerezi</span><span className="mono">HttpOnly · Secure · SameSite=Strict</span></li>
            <li><span>Okur oturumu</span><span className="mono">12 sa · 30 dk boşta</span></li>
            <li><span>Yönetici girişi</span><span className="mono">e-posta + parola</span></li>
            <li><span>{ADMIN_RULES.maxFails} hata / {ADMIN_RULES.windowMin} dk, aynı IP</span><span className="mono">{ADMIN_RULES.windowMin} dk kilit</span></li>
            <li><span>{ADMIN_RULES.accountMaxFails} hata / saat, aynı hesap</span><span className="mono">hesap 1 sa kilit</span></li>
          </ul>
          <div style={{ borderTop: '1px solid #EFEBE3', marginTop: 14, paddingTop: 16 }}>
            <PinForm />
            <p className="hint" style={{ margin: '8px 0 0' }}>{pin ? `Son değişiklik ${dotsDT(pin.updatedAt)}. ` : 'PIN henüz ayarlanmadı. '}Değişince tüm açık okur oturumları kapanır.</p>
          </div>
        </section>
      </div>

      <section className="card flush mt">
        <div className="ct"><h2>Yönetici oturumları</h2><span className="x">bu cihaz işaretli</span></div>
        <div className="tbw">
          <table className="tb">
            <thead><tr><th>Cihaz</th><th>IP</th><th>Başladı</th><th>Son hareket</th><th /></tr></thead>
            <tbody>
              {(adminSessions.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.device} / {s.browser}{s.id === me.sessionId && <span className="pill" style={{ marginLeft: 8 }}>bu cihaz</span>}</td>
                  <td className="mono">{s.ip ?? '—'}</td><td className="mono">{dotsDT(s.created_at)}</td><td className="mono">{dotsDT(s.last_seen_at)}</td>
                  <td className="r">{s.id !== me.sessionId && <form action={endAdminSessionAction}><input type="hidden" name="id" value={s.id} /><button className="btn sm dan" type="submit">Kapat</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card flush mt">
        <div className="ct"><h2>Yönetici girişleri</h2><span className="x">son 30 kayıt</span></div>
        <div className="tbw">
          <table className="tb">
            <thead><tr><th>Zaman</th><th>Sonuç</th><th>IP</th><th>Konum</th><th>Cihaz</th></tr></thead>
            <tbody>
              {(logins.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="mono">{dotsDT(a.at)}</td>
                  <td><span className={'pill ' + (a.success ? 'good' : 'bad')}>{a.success ? 'Başarılı' : 'Başarısız'}{a.reason && !['giriş'].includes(a.reason) ? ' · ' + a.reason : ''}</span></td>
                  <td className="mono">{a.ip ?? '—'}</td><td>{[a.country, a.city].filter(Boolean).join(' · ') || '—'}</td><td>{a.device} / {a.browser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt">
        <div className="ct"><h2>Ne saklanıyor, ne saklanmıyor</h2></div>
        <ul className="rules">
          <li><span>Girilen PIN rakamları</span><span>hiçbir zaman</span></li>
          <li><span>IP adresi</span><span>30 gün, sonra son hanesi silinir</span></li>
          <li><span>Konum</span><span>yalnızca ülke ve şehir, IP’den tahmini</span></li>
          <li><span>Cihaz ve tarayıcı</span><span>genel tür; parmak izi yok</span></li>
          <li><span>Referer</span><span>yalnızca alan adı</span></li>
          <li><span>Okurun ismi</span><span>kendi yazdığı haliyle, oturuma bağlı</span></li>
        </ul>
        <p className="hint" style={{ margin: '10px 0 0' }}>Saat: {hm(new Date())} (İstanbul)</p>
      </section>
    </div>
  );
}
