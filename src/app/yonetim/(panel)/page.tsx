import Link from 'next/link';
import { db } from '@/lib/db';
import { dayTick, failAlert, getAnalytics, istMidnightIso } from '@/lib/admin-data';
import { hm, nf, shortDT } from '@/lib/format';
import { AlertIcon, Bars, Empty, HBars, Kpi, Status } from '@/components/admin/Charts';
import { revokeSessionAction } from '../actions';

export const dynamic = 'force-dynamic';

const OUTCOME: Record<string, [string, string]> = {
  fail: ['Başarısız', 'pill bad'], wait: ['Bekletildi', 'pill'], blocked: ['Engelli IP', 'pill bad']
};

export default async function Dashboard() {
  const sb = db();
  const [a14, a30, today, active, entries, fails24, recentFails, top, alert] = await Promise.all([
    getAnalytics(14),
    getAnalytics(30),
    sb.from('reader_sessions').select('id', { count: 'exact', head: true }).gte('created_at', istMidnightIso(0)),
    sb.from('v_sessions').select('id, name, device, browser, city, country, created_at, last_seen_at, status').eq('status', 'active').order('last_seen_at', { ascending: false }).limit(10),
    sb.from('entries').select('category, published'),
    sb.from('pin_attempts').select('id', { count: 'exact', head: true }).eq('outcome', 'fail').gte('attempted_at', new Date(Date.now() - 86400000).toISOString()),
    sb.from('pin_attempts').select('attempted_at, name, ip, country, device, browser, outcome').neq('outcome', 'ok').order('attempted_at', { ascending: false }).limit(5),
    sb.from('v_entry_stats').select('entry_id, views').gt('views', 0).order('views', { ascending: false }).limit(5),
    failAlert()
  ]);

  const ent = entries.data ?? [];
  const byCat = (c: string) => ent.filter((e) => e.category === c);
  const pubCount = ent.filter((e) => e.published).length;
  const last7 = a14.daily.slice(-7).reduce((s, d) => s + d.sessions, 0);
  const new7 = a14.daily.slice(-7).reduce((s, d) => s + d.new, 0);
  const yesterday = a14.daily.at(-2)?.sessions ?? 0;
  const topIds = (top.data ?? []).map((t) => t.entry_id);
  const { data: topTitles } = topIds.length ? await sb.from('entries').select('id, title').in('id', topIds) : { data: [] as { id: string; title: string }[] };
  const titleOf = (id: string) => topTitles?.find((t) => t.id === id)?.title ?? '—';
  const now = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div>
      <div className="ph">
        <div><h1>Genel</h1><p className="sub">{now} · {hm(new Date())} itibarıyla</p></div>
        <div className="acts"><Link className="btn" href="/yonetim/analitik">Analitik</Link><Link className="btn pri" href="/yonetim/icerikler/yeni">+ Yeni İçerik</Link></div>
      </div>

      {alert && (
        <div className="alertbar" role="alert">
          <AlertIcon />
          <span><b>Son 15 dakikada {alert.count} başarısız deneme.</b>{alert.ip && <> En çok {alert.ip} ({alert.ipCount}){alert.blockedUntil ? `, ${hm(alert.blockedUntil)}’e kadar engelli` : ''}.</>}</span>
          <span className="sp2" />
          <Link className="btn sm dan" href="/yonetim/basarisiz">İncele</Link>
        </div>
      )}

      <div className="kpis">
        <Kpi l="Toplam ziyaret" v={nf(a30.totals.sessions_all)} n={`${nf(a30.totals.visitors_all)} farklı okur`} />
        <Kpi l="Bugün" v={today.count ?? 0} n={`dün ${yesterday}`} />
        <Kpi l="Son 7 gün" v={last7} n={`${new7} yeni · ${Math.max(0, last7 - new7)} tekrar`} />
        <Kpi l="Son 30 gün" v={a30.totals.sessions} n={`${a30.totals.visitors} tekil okur`} />
        <Kpi l="Aktif oturumlar" v={(active.data ?? []).length} n="şu anda okuyor" />
      </div>
      <div className="kpis mt">
        <Kpi l="Toplam içerik" v={ent.length} n={`${pubCount} yayında · ${ent.length - pubCount} taslak`} />
        <Kpi l="Şiirler" v={byCat('siir').length} n={`${byCat('siir').filter((e) => e.published).length} yayında`} />
        <Kpi l="Notlar" v={byCat('not').length} n={`${byCat('not').filter((e) => e.published).length} yayında`} />
        <Kpi l="Defter" v={byCat('defter').length} n={`${byCat('defter').filter((e) => e.published).length} yayında`} />
        <Kpi l="Başarısız PIN" v={fails24.count ?? 0} n={alert ? `son 24 saat · ${alert.count}’i son 15 dk` : 'son 24 saat'} alert={!!alert} />
      </div>

      <div className="g2">
        <section className="card">
          <div className="ct"><h2>Ziyaretçi / gün</h2><span className="x">Son 14 gün · bugün vurgulu</span></div>
          <Bars data={a14.daily.map((d, i) => ({ v: d.visitors, l: dayTick(d.d, i), hi: i === a14.daily.length - 1 }))} />
        </section>
        <section className="card">
          <div className="ct"><h2>Aktif oturumlar</h2><span className="x">{(active.data ?? []).length} açık</span></div>
          {(active.data ?? []).length === 0 && <p className="hint" style={{ margin: 0 }}>Şu anda kimse okumuyor.</p>}
          {(active.data ?? []).map((s) => (
            <div className="li" key={s.id}>
              <Status s="active" />
              <div className="grow">
                <div className="t"><Link className="lk" href={`/yonetim/ziyaretciler/${s.id}`}>{s.name ?? 'isimsiz'}</Link></div>
                <div className="s">{s.device} / {s.browser}{s.city ? ' · ' + s.city : ''} · {hm(s.created_at)}’ten beri</div>
              </div>
              <form action={revokeSessionAction}><input type="hidden" name="id" value={s.id} /><button className="btn sm dan" type="submit">Sonlandır</button></form>
            </div>
          ))}
        </section>
      </div>

      <div className="g2">
        <section className="card">
          <div className="ct"><h2>En çok okunan</h2><span className="x">görüntülenme · tüm zamanlar</span></div>
          <HBars data={(top.data ?? []).map((t) => ({ k: titleOf(t.entry_id), n: t.views }))} empty="Henüz kimse okumadı." />
        </section>
        <section className="card">
          <div className="ct"><h2>Son başarısız denemeler</h2><Link className="lk" href="/yonetim/basarisiz" style={{ fontSize: 12.5, fontWeight: 400 }}>Tümü →</Link></div>
          {(recentFails.data ?? []).length === 0
            ? <Empty title="Kapı sakin." text="Henüz yanlış bir rakam girilmedi." />
            : (recentFails.data ?? []).map((f, i) => (
              <div className="li" key={i}>
                <span className="mono" style={{ width: 92 }}>{shortDT(f.attempted_at)}</span>
                <div className="grow"><div className="t">{f.name ?? 'isimsiz'}</div><div className="s">{f.country ?? 'Bilinmiyor'} · {f.device} / {f.browser} · <span className="mono">{f.ip ?? '—'}</span></div></div>
                <span className={OUTCOME[f.outcome]?.[1] ?? 'pill'}>{OUTCOME[f.outcome]?.[0] ?? f.outcome}</span>
              </div>
            ))}
        </section>
      </div>
    </div>
  );
}
