import Link from 'next/link';
import { db } from '@/lib/db';
import { fmtMinutes, hm, shortDT } from '@/lib/format';
import { Empty, Status } from '@/components/admin/Charts';

export const dynamic = 'force-dynamic';

const TABS: [string, string][] = [['tumu', 'Tümü'], ['aktif', 'Aktif'], ['gecmis', 'Geçmiş']];

export default async function Ziyaretciler({ searchParams }: { searchParams: Promise<{ q?: string; durum?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 40);
  const durum = TABS.some(([k]) => k === sp.durum) ? sp.durum! : 'tumu';

  const sb = db();
  let query = sb.from('v_sessions')
    .select('id, name, created_at, last_seen_at, pages, device, browser, country, city, status')
    .not('name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (q) query = query.ilike('name', `%${q.replace(/[%_\\]/g, (m) => '\\' + m)}%`);
  if (durum === 'aktif') query = query.eq('status', 'active');
  if (durum === 'gecmis') query = query.neq('status', 'active');
  const [{ data: rows }, { count: total }, { count: activeCount }] = await Promise.all([
    query,
    sb.from('reader_sessions').select('id', { count: 'exact', head: true }).not('name', 'is', null),
    sb.from('v_sessions').select('id', { count: 'exact', head: true }).eq('status', 'active').not('name', 'is', null)
  ]);
  const list = rows ?? [];
  const href = (k: string) => `/yonetim/ziyaretciler?durum=${k}${q ? '&q=' + encodeURIComponent(q) : ''}`;
  const dur = (a: string, b: string) => fmtMinutes(new Date(b).getTime() - new Date(a).getTime());

  return (
    <div>
      <div className="ph"><div><h1>Ziyaretçiler</h1><p className="sub">PIN ile giren herkes, kendine verdiği isimle.</p></div></div>
      <section className="card flush">
        <div className="tools">
          <div className="tabs" role="group" aria-label="Durum">
            {TABS.map(([k, l]) => (
              <Link key={k} href={href(k)} className={'tab' + (durum === k ? ' on' : '')}>
                {l} · {k === 'tumu' ? total ?? 0 : k === 'aktif' ? activeCount ?? 0 : Math.max(0, (total ?? 0) - (activeCount ?? 0))}
              </Link>
            ))}
          </div>
          <form method="get" action="/yonetim/ziyaretciler" role="search">
            <input type="hidden" name="durum" value={durum} />
            <label className="sr" htmlFor="q">İsimle ara</label>
            <input id="q" name="q" className="search" type="search" placeholder="İsimle ara" defaultValue={q} />
          </form>
        </div>

        {list.length > 0 ? (
          <>
            <div className="tbw hs">
              <table className="tb">
                <thead><tr><th>İsim</th><th>İlk giriş</th><th>Son görülme</th><th>Oturum</th><th className="r">Sayfa</th><th>Cihaz</th><th>Konum</th><th>Durum</th></tr></thead>
                <tbody>
                  {list.map((v) => (
                    <tr key={v.id}>
                      <td><Link className="lk" href={`/yonetim/ziyaretciler/${v.id}`}>{v.name}</Link></td>
                      <td className="mono">{shortDT(v.created_at)}</td>
                      <td className="mono">{hm(v.last_seen_at)}</td>
                      <td className="mono">{dur(v.created_at, v.last_seen_at)}</td>
                      <td className="r mono">{v.pages}</td>
                      <td>{v.device} / {v.browser}</td>
                      <td>{[v.country, v.city].filter(Boolean).join(' · ') || '—'}</td>
                      <td><Status s={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cards">
              {list.map((v) => (
                <Link key={v.id} className="mc" href={`/yonetim/ziyaretciler/${v.id}`} style={{ textDecoration: 'none' }}>
                  <span className="r1"><b>{v.name}</b><Status s={v.status} /></span>
                  <span className="r2">{shortDT(v.created_at)} → {hm(v.last_seen_at)} · {dur(v.created_at, v.last_seen_at)} · {v.pages} sayfa</span>
                  <span className="r2">{v.device} / {v.browser} · {[v.country, v.city].filter(Boolean).join(' · ') || '—'}</span>
                </Link>
              ))}
            </div>
          </>
        ) : q ? (
          <Empty title={`“${q}” diye biri uğramamış.`} text="Adını farklı yazmış olabilir; ya da henüz gelmedi.">
            <Link className="btn sm" href="/yonetim/ziyaretciler" style={{ marginTop: 18 }}>Aramayı temizle</Link>
          </Empty>
        ) : (total ?? 0) === 0 ? (
          <Empty title="Henüz kimse kapıyı çalmadı." text="PIN’i paylaştığın ilk kişi burada, kendine verdiği isimle görünecek." />
        ) : (
          <Empty title="Şu an burada kimse yok." text="Bu filtrede gösterilecek oturum bulunmadı." />
        )}
      </section>
    </div>
  );
}
