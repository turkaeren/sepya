import Link from 'next/link';
import { db } from '@/lib/db';
import { CATEGORY_NAMES, getAllEntries } from '@/lib/entries';
import { dateDots, dotsDT, fmtDuration, lowTR } from '@/lib/format';
import { Empty } from '@/components/admin/Charts';
import type { Category } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

const TABS: [string, string][] = [['tumu', 'Tümü'], ['siir', 'Şiir'], ['not', 'Not'], ['defter', 'Defter'], ['taslak', 'Taslak']];
const FLASH: Record<string, string> = { silindi: 'İçerik silindi.' };

export default async function Icerikler({ searchParams }: { searchParams: Promise<{ k?: string; q?: string; durum?: string }> }) {
  const sp = await searchParams;
  const k = TABS.some(([t]) => t === sp.k) ? sp.k! : 'tumu';
  const q = (sp.q ?? '').trim().slice(0, 80);
  const [all, { data: stats }] = await Promise.all([getAllEntries(), db().from('v_entry_stats').select('entry_id, views, avg_ms')]);
  const statOf = (id: string) => stats?.find((s) => s.entry_id === id);
  const count = (t: string) => t === 'tumu' ? all.length : t === 'taslak' ? all.filter((e) => !e.published).length : all.filter((e) => e.category === t).length;
  const list = all
    .filter((e) => k === 'tumu' || (k === 'taslak' ? !e.published : e.category === k))
    .filter((e) => !q || lowTR(e.title).includes(lowTR(q)));

  return (
    <div>
      <div className="ph">
        <div><h1>İçerikler</h1><p className="sub">Okur tarafında tarih sırasıyla, en yeni önce görünür.</p></div>
        <div className="acts"><Link className="btn" href="/yonetim/icerikler/ice-aktar">WordPress’ten al</Link><Link className="btn pri" href="/yonetim/icerikler/yeni">+ Yeni İçerik</Link></div>
      </div>
      {sp.durum && FLASH[sp.durum] && <div className="okbar" role="status">{FLASH[sp.durum]}</div>}

      <section className="card flush">
        <div className="tools">
          <div className="tabs" role="group" aria-label="Kategori">
            {TABS.map(([t, l]) => <Link key={t} href={`/yonetim/icerikler?k=${t}${q ? '&q=' + encodeURIComponent(q) : ''}`} className={'tab' + (k === t ? ' on' : '')}>{l} · {count(t)}</Link>)}
          </div>
          <form method="get" action="/yonetim/icerikler" role="search">
            <input type="hidden" name="k" value={k} />
            <label className="sr" htmlFor="cq">Başlıkta ara</label>
            <input id="cq" name="q" className="search" type="search" placeholder="Başlıkta ara" defaultValue={q} />
          </form>
        </div>

        {all.length === 0 ? (
          <Empty title="Masa boş." text="İlk yazını eklediğinde burada, tarih sırasıyla dizilecek.">
            <Link className="btn pri" href="/yonetim/icerikler/yeni" style={{ marginTop: 20 }}>+ Yeni İçerik</Link>
          </Empty>
        ) : list.length === 0 ? (
          <Empty title={q ? `“${q}” başlıklı bir yazı yok.` : 'Bu rafta yazı yok.'} text="Başka bir kelime ya da kategori dene.">
            <Link className="btn sm" href="/yonetim/icerikler" style={{ marginTop: 18 }}>Filtreyi temizle</Link>
          </Empty>
        ) : (
          <>
            <div className="tbw hs">
              <table className="tb">
                <thead><tr><th>Başlık</th><th>Kategori</th><th>Tarih</th><th>Durum</th><th className="r">Görüntülenme</th><th className="r">Ort. okuma</th><th>Güncellendi</th><th /></tr></thead>
                <tbody>
                  {list.map((e) => {
                    const st = statOf(e.id);
                    return (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: 'normal', minWidth: 200 }}><Link className="lk" href={`/yonetim/icerikler/${e.id}`}>{e.title}</Link></td>
                        <td>{CATEGORY_NAMES[e.category as Category]}</td>
                        <td className="mono">{dateDots(e.entry_date)}</td>
                        <td>{e.published ? <span className="pill good">Yayında</span> : <span className="pill dr">Taslak</span>}</td>
                        <td className="r mono">{st?.views ? st.views : '—'}</td>
                        <td className="r mono">{fmtDuration(st?.avg_ms)}</td>
                        <td className="mono mu">{dotsDT(e.updated_at)}</td>
                        <td className="r">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Link className="btn sm" href={`/yonetim/icerikler/${e.id}/istatistik`}>İstatistik</Link>
                            <Link className="btn sm" href={`/yonetim/icerikler/${e.id}`}>Düzenle</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="cards">
              {list.map((e) => (
                <Link key={e.id} className="mc" href={`/yonetim/icerikler/${e.id}`} style={{ textDecoration: 'none' }}>
                  <span className="r1"><b>{e.title}</b>{e.published ? <span className="pill good">Yayında</span> : <span className="pill dr">Taslak</span>}</span>
                  <span className="r2">{CATEGORY_NAMES[e.category as Category]} · {dateDots(e.entry_date)} · {statOf(e.id)?.views ?? 0} görüntülenme</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
