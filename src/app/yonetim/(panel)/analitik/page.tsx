import Link from 'next/link';
import { dayTick, getAnalytics } from '@/lib/admin-data';
import { fmtDuration, nf } from '@/lib/format';
import { Bars, HBars, Line, PairBars, StackBars } from '@/components/admin/Charts';

export const dynamic = 'force-dynamic';

const RANGES = [7, 14, 30, 90];
const CAT: Record<string, string> = { siir: 'Şiirler', not: 'Notlar', defter: 'Defter' };

export default async function Analitik({ searchParams }: { searchParams: Promise<{ gun?: string }> }) {
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.gun)) ? Number(sp.gun) : 14;
  const a = await getAnalytics(days);
  const labels = a.daily.map((d, i) => dayTick(d.d, i));
  const tail = a.daily.slice(-Math.min(days, 14));
  const tailLabels = tail.map((d, i) => dayTick(d.d, i));
  const okSum = a.daily.reduce((s, d) => s + d.ok, 0);
  const failSum = a.daily.reduce((s, d) => s + d.fail, 0);
  const newSum = tail.reduce((s, d) => s + d.new, 0);
  const visSum = tail.reduce((s, d) => s + d.visitors, 0);
  const peak = a.hours.indexOf(Math.max(...a.hours));
  const dense = days > 30;

  return (
    <div>
      <div className="ph">
        <div><h1>Analitik</h1><p className="sub">Yalnızca PIN ile girilmiş oturumlar sayılır.</p></div>
        <div className="tabs" role="group" aria-label="Zaman aralığı">
          {RANGES.map((r) => <Link key={r} href={`/yonetim/analitik?gun=${r}`} className={'tab' + (r === days ? ' on' : '')} aria-current={r === days ? 'true' : undefined}>{r} gün</Link>)}
        </div>
      </div>

      <div className="gh" style={{ marginTop: 0 }}>
        <section className="card">
          <div className="ct"><h2>Ziyaretçi / gün</h2><span className="x">Toplam {nf(a.totals.sessions)} oturum · {nf(a.totals.visitors)} okur</span></div>
          <Bars data={a.daily.map((d, i) => ({ v: d.visitors, l: dense && i % 7 ? '' : labels[i] }))} showValues={!dense} gap={dense ? 2 : 6} />
        </section>
        <section className="card">
          <div className="ct"><h2>Sayfa görüntüleme / gün</h2><span className="x">Toplam {nf(a.totals.views)} · oturum başı {a.totals.sessions ? (a.totals.views / a.totals.sessions).toFixed(1).replace('.', ',') : '0'}</span></div>
          <Line values={a.daily.map((d) => d.views)} labels={labels} />
        </section>
        <section className="card">
          <div className="ct"><h2>Yeni ve tekrar gelen</h2>
            <div className="legend"><span><i style={{ background: '#1B1A17' }} />yeni · {newSum}</span><span><i style={{ background: '#B9B1A2' }} />tekrar · {Math.max(0, visSum - newSum)}</span></div></div>
          <StackBars data={tail.map((d, i) => ({ a: d.new, b: Math.max(0, d.visitors - d.new), l: tailLabels[i] }))} />
        </section>
        <section className="card">
          <div className="ct"><h2>Başarılı ve başarısız giriş</h2>
            <div className="legend"><span><i style={{ background: '#1B1A17' }} />başarılı · {okSum}</span><span><i style={{ background: '#7B2431' }} />başarısız · {failSum}</span></div></div>
          <PairBars data={tail.map((d, i) => ({ a: d.ok, b: d.fail, l: tailLabels[i] }))} />
        </section>
        <section className="card">
          <div className="ct"><h2>En çok okunan içerikler</h2><span className="x">görüntülenme · ort. süre</span></div>
          <HBars data={a.top.map((t) => ({ k: `${t.title} · ${fmtDuration(t.avg)}`, n: t.n }))} empty="Bu aralıkta okunan içerik yok." />
        </section>
        <section className="card">
          <div className="ct"><h2>Kategoriler</h2><span className="x">görüntülenme payı</span></div>
          <HBars data={a.categories.map((c) => ({ k: CAT[c.k] ?? c.k, n: c.n }))} unit="%" />
          <div className="ct" style={{ margin: '26px 0 16px' }}><h2>Okuma saatleri</h2><span className="x">{a.hours.some((h) => h > 0) ? `en yoğun: ${String(peak).padStart(2, '0')}:00` : '—'}</span></div>
          <Bars data={a.hours.map((v) => ({ v, l: '' }))} height={70} showValues={false} gap={2} />
          <div className="xl"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
        </section>
        <section className="card">
          <div className="ct"><h2>Cihaz</h2></div>
          <HBars data={a.devices} unit="%" />
          <div className="ct" style={{ margin: '26px 0 16px' }}><h2>Ülke</h2></div>
          <HBars data={a.countries} unit="%" />
        </section>
        <section className="card">
          <div className="ct"><h2>Tarayıcı</h2></div>
          <HBars data={a.browsers} unit="%" />
        </section>
      </div>
    </div>
  );
}
