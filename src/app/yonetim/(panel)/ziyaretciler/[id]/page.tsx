import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { dotsDT, fmtDuration, fmtMinutes, hm, hms, shortDT } from '@/lib/format';
import { HBars, Kpi, Status } from '@/components/admin/Charts';
import { blockIpAction, revokeSessionAction } from '../../../actions';

export const dynamic = 'force-dynamic';

const KIND: Record<string, string> = { title: 'Ana sayfa', section: 'Kategori açılışı', empty: 'Boş sayfa', archive: 'Arşiv', menu: 'Yazılar listesi' };
const CAT: Record<string, string> = { siir: 'Şiirler', not: 'Notlar', defter: 'Defter' };

export default async function Ziyaretci({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = db();
  const { data: s } = await sb.from('v_sessions').select('*').eq('id', id).maybeSingle();
  if (!s) notFound();
  const { data: srcRow } = await sb.from('reader_sessions').select('source, source_ref').eq('id', id).maybeSingle();

  const [{ data: views }, { data: others }] = await Promise.all([
    sb.from('page_views').select('id, kind, label, part, category, entry_id, viewed_at, duration_ms').eq('session_id', id).order('viewed_at', { ascending: true }).limit(500),
    sb.from('v_sessions').select('id, created_at, last_seen_at, pages, device, browser').eq('visitor_id', s.visitor_id).neq('id', id).order('created_at', { ascending: false }).limit(10)
  ]);
  const pv = views ?? [];
  const reading = pv.filter((p) => p.kind !== 'menu' && p.kind !== 'archive');
  const maxMs = Math.max(1, ...pv.map((p) => p.duration_ms ?? 0));
  const distinctEntries = new Set(pv.filter((p) => p.entry_id).map((p) => p.entry_id)).size;
  const totalMs = new Date(s.last_seen_at).getTime() - new Date(s.created_at).getTime();
  const catCounts = Object.entries(pv.reduce<Record<string, number>>((acc, p) => {
    if (p.kind === 'entry' && p.category) acc[p.category] = (acc[p.category] ?? 0) + (p.duration_ms ?? 0);
    return acc;
  }, {})).map(([k, n]) => ({ k: CAT[k] ?? k, n })).sort((a, b) => b.n - a.n);
  const ended = s.status !== 'active';
  const visitNo = (others ?? []).length + 1;

  return (
    <div>
      <Link className="back" href="/yonetim/ziyaretciler">← Ziyaretçiler</Link>
      <div className="ph">
        <div>
          <h1>{s.name ?? 'isimsiz'}</h1>
          <p className="sub"><Status s={s.status} /> · {visitNo}. ziyaret{visitNo > 1 && others?.length ? ` · ilk kez ${shortDT(others[others.length - 1].created_at)}` : ''}</p>
        </div>
        <div className="acts">
          {!ended && (
            <form action={revokeSessionAction}><input type="hidden" name="id" value={s.id} /><button className="btn dan" type="submit">Oturumu sonlandır</button></form>
          )}
          {s.ip && (
            <form action={blockIpAction}><input type="hidden" name="ip" value={s.ip} /><input type="hidden" name="hours" value="24" /><button className="btn" type="submit">IP’yi 24 saat engelle</button></form>
          )}
        </div>
      </div>

      <div className="kpis k4">
        <Kpi l="Giriş" v={hm(s.created_at)} n={dotsDT(s.created_at).slice(0, 10)} />
        <Kpi l="Çıkış" v={ended ? hm(s.ended_at ?? s.last_seen_at) : '—'} n={ended ? (s.status === 'revoked' ? 'yönetici sonlandırdı' : 'son hareket') : 'hâlâ okuyor'} />
        <Kpi l="Toplam süre" v={fmtMinutes(totalMs)} n={reading.length ? `sayfa başı ${fmtDuration(totalMs / reading.length)}` : undefined} />
        <Kpi l="Görüntülenen sayfa" v={s.pages} n={`${distinctEntries} farklı içerik`} />
      </div>

      <div className="g2">
        <section className="card">
          <div className="ct"><h2>Okuma sırası</h2><span className="x">sayfada kalma süresi</span></div>
          <div className="tl"><span className="mono mu">{hms(s.created_at)}</span><span className="tt sys">Giriş · PIN doğru</span><span /></div>
          {pv.length === 0 && <p className="hint">Henüz bir sayfa açılmadı.</p>}
          {pv.map((p) => {
            const what = p.kind === 'entry' ? `${p.label ?? 'İçerik'}${p.part && p.part > 1 ? ' · ' + ['I', 'II', 'III', 'IV', 'V', 'VI'][p.part - 1] : ''}` : p.kind === 'section' ? `${KIND.section}: ${p.label ?? ''}` : KIND[p.kind] ?? p.kind;
            const sys = p.kind === 'menu';
            return (
              <div className="tl" key={p.id}>
                <span className="mono mu">{hms(p.viewed_at)}</span>
                <span className={'tt' + (sys ? ' sys' : '')}>
                  {p.entry_id ? <Link className="lk" style={{ fontWeight: 400 }} href={`/yonetim/icerikler/${p.entry_id}/istatistik`}>{what}</Link> : what}
                </span>
                <span className="mono" style={{ textAlign: 'right' }}>{p.duration_ms != null ? fmtDuration(p.duration_ms) : (ended ? '' : 'şimdi')}</span>
                <div className="tk"><div className="fl" style={{ width: Math.round(((p.duration_ms ?? 0) / maxMs) * 100) + '%' }} /></div>
              </div>
            );
          })}
        </section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section className="card">
            <div className="ct"><h2>Oturum</h2></div>
            <dl className="kv2">
              <dt>Cihaz</dt><dd>{s.device} · {s.os}</dd>
              <dt>Tarayıcı</dt><dd>{s.browser}</dd>
              <dt>Konum</dt><dd>{[s.country, s.city].filter(Boolean).join(' · ') || '—'} (yaklaşık)</dd>
              <dt>IP</dt><dd className="mono">{s.ip ?? '—'}</dd>
              <dt>Nereden geldi</dt><dd>{srcRow?.source ?? 'Bilinmiyor'}{srcRow?.source_ref && srcRow.source_ref !== srcRow.source ? ` · ${srcRow.source_ref}` : ''}</dd>
              <dt>Oturum kimliği</dt><dd className="mono">{s.id.slice(0, 8)}…{s.id.slice(-4)}</dd>
              <dt>Başlangıç</dt><dd className="mono">{dotsDT(s.created_at)}</dd>
              <dt>Son hareket</dt><dd className="mono">{dotsDT(s.last_seen_at)}</dd>
              <dt>Geçerlilik</dt><dd>{dotsDT(s.expires_at)}’e kadar · 30 dk boşta biter</dd>
            </dl>
          </section>
          <section className="card">
            <div className="ct"><h2>Kategori ilgisi</h2><span className="x">okuma süresine göre</span></div>
            <HBars data={catCounts} unit="%" empty="Henüz bir yazı okunmadı." />
          </section>
          <section className="card">
            <div className="ct"><h2>Önceki ziyaretler</h2></div>
            {(others ?? []).length === 0 && <p className="hint" style={{ margin: 0 }}>İlk ziyareti.</p>}
            {(others ?? []).map((o) => (
              <div className="li" key={o.id}>
                <div className="grow">
                  <div className="t"><Link className="lk" href={`/yonetim/ziyaretciler/${o.id}`}>{shortDT(o.created_at)}</Link></div>
                  <div className="s">{fmtMinutes(new Date(o.last_seen_at).getTime() - new Date(o.created_at).getTime())} · {o.pages} sayfa · {o.device} / {o.browser}</div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
