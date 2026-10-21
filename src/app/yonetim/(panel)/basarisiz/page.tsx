import Link from 'next/link';
import { db, must } from '@/lib/db';
import { failAlert } from '@/lib/admin-data';
import { dateDots, hm, hms, istDay } from '@/lib/format';
import { AlertIcon, Bars, Empty, Kpi } from '@/components/admin/Charts';
import { blockIpAction, unblockIpAction } from '../../actions';

export const dynamic = 'force-dynamic';

const RANGES: [string, string][] = [['24s', '24 saat'], ['7g', '7 gün'], ['30g', '30 gün']];
const OUTCOME: Record<string, [string, string]> = {
  fail: ['Başarısız', 'pill bad'], wait: ['Bekletildi', 'pill'], blocked: ['Engelli IP', 'pill bad']
};

export default async function Basarisiz({ searchParams }: { searchParams: Promise<{ aralik?: string; sayfa?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.some(([k]) => k === sp.aralik) ? sp.aralik! : '24s';
  const page = Math.max(0, Number.parseInt(sp.sayfa ?? '0', 10) || 0);
  const PER = 50;
  const sb = db();
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  const [c24, c7, c30, blocks, rows, alert, series] = await Promise.all([
    sb.from('pin_attempts').select('id', { count: 'exact', head: true }).eq('outcome', 'fail').gte('attempted_at', ago(86400000)),
    sb.from('pin_attempts').select('id', { count: 'exact', head: true }).eq('outcome', 'fail').gte('attempted_at', ago(7 * 86400000)),
    sb.from('pin_attempts').select('id', { count: 'exact', head: true }).eq('outcome', 'fail').gte('attempted_at', ago(30 * 86400000)),
    sb.from('ip_blocks').select('ip, until, reason').gt('until', new Date().toISOString()).order('until', { ascending: false }),
    sb.from('pin_attempts').select('id, attempted_at, name, ip, country, city, device, os, browser, outcome', { count: 'exact' })
      .neq('outcome', 'ok').order('attempted_at', { ascending: false }).range(page * PER, page * PER + PER - 1),
    failAlert(),
    range === '24s' ? sb.rpc('admin_fail_hourly') : sb.rpc('admin_fail_daily', { p_days: range === '7g' ? 7 : 30 })
  ]);

  const pts = must(series) as { t?: string; d?: string; n: number }[];
  const bars = pts.map((p, i) => {
    if (p.t) { const h = Number(hm(p.t).slice(0, 2)); return { v: Number(p.n), l: h % 6 === 0 ? String(h).padStart(2, '0') : '' }; }
    const day = Number(p.d!.slice(8, 10));
    return { v: Number(p.n), l: range === '7g' || i % 5 === 0 ? String(day) : '' };
  });
  const list = rows.data ?? [];
  const totalRows = rows.count ?? 0;
  const activeBlocks = blocks.data ?? [];

  return (
    <div>
      <div className="ph">
        <div><h1>Başarısız denemeler</h1><p className="sub">Kim denedi, ne zaman, nereden. Girilen rakamlar hiçbir zaman kaydedilmez.</p></div>
        <div className="acts"><Link className="btn" href="/yonetim/guvenlik">Koruma kuralları</Link></div>
      </div>

      {alert && (
        <div className="alertbar" role="alert">
          <AlertIcon />
          <span><b>Son 15 dakikada {alert.count} başarısız deneme.</b>{alert.ip && <> En çok {alert.ip} ({alert.ipCount}){alert.blockedUntil ? ` · ${hm(alert.blockedUntil)}’e kadar engelli` : ''}.</>}</span>
          <span className="sp2" />
          {alert.ip && (
            <form action={blockIpAction}>
              <input type="hidden" name="ip" value={alert.ip} /><input type="hidden" name="hours" value="720" />
              <button className="btn sm dan" type="submit">IP’yi 30 gün engelle</button>
            </form>
          )}
        </div>
      )}

      <div className="kpis k4">
        <Kpi l="Son 24 saat" v={c24.count ?? 0} alert={!!alert} n={alert ? `${alert.count}’i son 15 dk` : undefined} />
        <Kpi l="Son 7 gün" v={c7.count ?? 0} />
        <Kpi l="Son 30 gün" v={c30.count ?? 0} />
        <Kpi l="Engelli IP" v={activeBlocks.length} n={activeBlocks[0] ? `${hm(activeBlocks[0].until)}’e kadar: ${activeBlocks[0].ip}` : 'yok'} />
      </div>

      <section className="card mt">
        <div className="ct">
          <h2>Denemeler</h2>
          <div className="tabs" role="group" aria-label="Aralık">
            {RANGES.map(([k, l]) => <Link key={k} href={`/yonetim/basarisiz?aralik=${k}`} className={'tab' + (range === k ? ' on' : '')}>{l}</Link>)}
          </div>
        </div>
        <Bars data={bars} height={150} accent gap={3} />
      </section>

      {activeBlocks.length > 0 && (
        <section className="card flush mt">
          <div className="ct"><h2>Engelli adresler</h2></div>
          <div className="tbw">
            <table className="tb">
              <thead><tr><th>IP</th><th>Bitiş</th><th>Neden</th><th /></tr></thead>
              <tbody>
                {activeBlocks.map((b) => (
                  <tr key={b.ip}>
                    <td className="mono">{b.ip}</td><td className="mono">{dateDots(istDay(b.until))} {hm(b.until)}</td><td>{b.reason}</td>
                    <td className="r"><form action={unblockIpAction}><input type="hidden" name="ip" value={b.ip} /><button className="btn sm" type="submit">Kaldır</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card flush mt">
        <div className="ct"><h2>Kayıt</h2><span className="x">en yeni üstte · {totalRows} kayıt</span></div>
        {list.length === 0 ? (
          <Empty title="Kapı sakin." text="Kimse yanlış bir rakam girmedi." />
        ) : (
          <>
            <div className="tbw hs">
              <table className="tb">
                <thead><tr><th>İsim</th><th>Tarih</th><th>Saat</th><th>IP</th><th>Ülke</th><th>Cihaz</th><th>Tarayıcı</th><th>Sonuç</th></tr></thead>
                <tbody>
                  {list.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 500 }}>{f.name ?? <span className="mu">—</span>}</td>
                      <td className="mono">{dateDots(istDay(f.attempted_at))}</td><td className="mono">{hms(f.attempted_at)}</td>
                      <td className="mono">{f.ip ?? '—'}</td><td>{[f.country, f.city].filter(Boolean).join(' · ') || '—'}</td>
                      <td>{f.device}</td><td>{f.browser}</td>
                      <td><span className={OUTCOME[f.outcome]?.[1] ?? 'pill'}>{OUTCOME[f.outcome]?.[0] ?? f.outcome}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cards">
              {list.map((f) => (
                <div className="mc" key={f.id} style={{ cursor: 'default' }}>
                  <span className="r1"><b>{f.name ?? 'isimsiz'} <span className="mono mu" style={{ fontSize: 12, fontWeight: 400 }}>{dateDots(istDay(f.attempted_at))} {hms(f.attempted_at)}</span></b><span className={OUTCOME[f.outcome]?.[1] ?? 'pill'}>{OUTCOME[f.outcome]?.[0]}</span></span>
                  <span className="r2">{f.country ?? 'Bilinmiyor'} · {f.device} / {f.browser}</span>
                  <span className="r2 mono">{f.ip ?? '—'}</span>
                </div>
              ))}
            </div>
            {totalRows > PER && (
              <div className="pager">
                {page > 0 ? <Link className="btn sm" href={`/yonetim/basarisiz?aralik=${range}&sayfa=${page - 1}`}>← Daha yeni</Link> : <span />}
                <span>{page * PER + 1}–{Math.min(totalRows, (page + 1) * PER)} / {totalRows}</span>
                {(page + 1) * PER < totalRows ? <Link className="btn sm" href={`/yonetim/basarisiz?aralik=${range}&sayfa=${page + 1}`}>Daha eski →</Link> : <span />}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
