import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, must } from '@/lib/db';
import { CATEGORY_NAMES, getEntry } from '@/lib/entries';
import { dayTick } from '@/lib/admin-data';
import { fmtDuration, shortDT } from '@/lib/format';
import { entryPages, type Category } from '@/lib/pagination';
import { Bars, Empty, HBars, Kpi } from '@/components/admin/Charts';

export const dynamic = 'force-dynamic';

interface Stats {
  views: number; visitors: number; avg_ms: number | null; views_7d: number; finish_rate: number | null;
  last: { at: string; name: string | null; device: string | null } | null;
  daily: { d: string; n: number }[];
  devices: { k: string; n: number }[]; countries: { k: string; n: number }[];
  dwell: number[];
  readers: { session: string; name: string | null; at: string; ms: number | null; device: string | null; browser: string | null }[];
}

export default async function Istatistik({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await getEntry(id);
  if (!e) notFound();
  const s = must(await db().rpc('admin_entry_stats', { p_entry: id, p_days: 14 })) as Stats;
  const parts = entryPages(e).length;
  const top = (arr: { k: string; n: number }[]) => {
    const tot = arr.reduce((a, b) => a + b.n, 0);
    return arr[0] ? `${arr[0].k} · %${Math.round((arr[0].n / tot) * 100)}` : '—';
  };
  const dwellTotal = s.dwell.reduce((a, b) => a + b, 0);

  return (
    <div>
      <Link className="back" href="/yonetim/icerikler">← İçerikler</Link>
      <div className="ph">
        <div>
          <h1>{e.title}</h1>
          <p className="sub">{CATEGORY_NAMES[e.category as Category]} · {e.entry_date.split('-').reverse().join('.')} · {e.published ? <span className="pill good">Yayında</span> : <span className="pill dr">Taslak</span>} · {parts} sayfa</p>
        </div>
        <div className="acts"><Link className="btn" href={`/yonetim/icerikler/${e.id}`}>Düzenle</Link></div>
      </div>

      <div className="kpis k4">
        <Kpi l="Görüntülenme" v={s.views} n={`son 7 günde ${s.views_7d}`} />
        <Kpi l="Tekil ziyaretçi" v={s.visitors} n={s.visitors ? `okur başı ${(s.views / s.visitors).toFixed(1).replace('.', ',')} kez` : undefined} />
        <Kpi l="Ort. okuma süresi" v={fmtDuration(s.avg_ms)} n={parts > 1 && s.finish_rate != null ? `sona kadar okuyan %${s.finish_rate}` : undefined} />
        <Kpi l="Son görüntülenme" v={s.last ? shortDT(s.last.at) : '—'} small n={s.last ? `${s.last.name ?? 'isimsiz'} · ${s.last.device ?? ''}` : undefined} />
      </div>

      {s.views === 0 ? (
        <section className="card mt"><Empty title="Henüz kimse okumadı." text="İlk okur geldiğinde burada ne kadar kaldığı, nereden ve hangi cihazdan okuduğu görünecek." /></section>
      ) : (
        <>
          <div className="g2">
            <section className="card">
              <div className="ct"><h2>Görüntülenme / gün</h2><span className="x">son 14 gün</span></div>
              <Bars data={s.daily.map((d, i) => ({ v: d.n, l: dayTick(d.d, i), hi: i === s.daily.length - 1 }))} />
              <div className="ct" style={{ margin: '26px 0 16px' }}><h2>Okuma süresi dağılımı</h2><span className="x">okumaların payı</span></div>
              <Bars height={120} data={['0–15 sn', '15–30', '30–45', '45–60', '60+'].map((l, i) => ({ v: dwellTotal ? Math.round((s.dwell[i] / dwellTotal) * 100) : 0, l }))} />
            </section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <section className="card">
                <div className="ct"><h2>En çok hangi cihazdan</h2><span className="x">{top(s.devices)}</span></div>
                <HBars data={s.devices.slice(0, 5)} unit="%" />
              </section>
              <section className="card">
                <div className="ct"><h2>En çok hangi ülkeden</h2><span className="x">{top(s.countries)}</span></div>
                <HBars data={s.countries.slice(0, 5)} unit="%" />
              </section>
            </div>
          </div>
          <section className="card flush mt">
            <div className="ct"><h2>Son okuyanlar</h2></div>
            <div className="tbw">
              <table className="tb">
                <thead><tr><th>İsim</th><th>Zaman</th><th className="r">Sayfada</th><th>Cihaz</th></tr></thead>
                <tbody>
                  {s.readers.map((r, i) => (
                    <tr key={i}>
                      <td><Link className="lk" href={`/yonetim/ziyaretciler/${r.session}`}>{r.name ?? 'isimsiz'}</Link></td>
                      <td className="mono">{shortDT(r.at)}</td>
                      <td className="r mono">{fmtDuration(r.ms)}</td>
                      <td>{r.device} / {r.browser}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
