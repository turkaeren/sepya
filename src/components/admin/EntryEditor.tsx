'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { entryPages, type Category } from '@/lib/pagination';
import { Page } from '@/components/reader/Page';
import { saveEntryAction, type FormState } from '@/app/yonetim/actions';
import '@/components/reader/reader.css';

export interface EditorEntry {
  id?: string;
  title: string;
  category: Category;
  entry_date: string;
  content: string;
  published: boolean;
  sort_order: number;
}

const DEVICES: [number, number][] = [[375, 812], [390, 844], [430, 932]];

function Phone({ w, h, scale, children }: { w: number; h: number; scale: number; children: React.ReactNode }) {
  return (
    <div className="phone">
      <div className="screen" style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}>
        <div className="scaler" style={{ width: w, height: h, transform: `scale(${scale})` }}>
          <div className="sp" style={{ position: 'absolute', inset: 0 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function EntryEditor({ initial, heading, sub, children }: { initial: EditorEntry; heading: string; sub: string; children?: React.ReactNode }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEntryAction, undefined);
  const [e, setE] = useState<EditorEntry>(initial);
  const [pi, setPi] = useState(0);
  const [full, setFull] = useState(false);
  const [dev, setDev] = useState(1);
  const set = (patch: Partial<EditorEntry>) => { setE((x) => ({ ...x, ...patch })); setPi(0); };

  const pages = useMemo(() => entryPages({ id: e.id, title: e.title, category: e.category, entry_date: e.entry_date, content: e.content }), [e]);
  const p = Math.min(pi, pages.length - 1);
  const pg = pages[p];
  const words = e.content.split(/\s+/).filter(Boolean).length;
  const secs = Math.max(5, Math.round(words / 3.2));
  const lines = e.content.split('\n').filter((l) => l.trim()).length;
  const dirty = JSON.stringify(e) !== JSON.stringify(initial);

  const nav = (
    <div className="pvnav">
      <button type="button" className="btn sm" onClick={() => setPi(Math.max(0, p - 1))} aria-label="Önceki sayfa" disabled={p === 0}>‹</button>
      <span className="mono">{p + 1} / {pages.length}</span>
      <button type="button" className="btn sm" onClick={() => setPi(Math.min(pages.length - 1, p + 1))} aria-label="Sonraki sayfa" disabled={p >= pages.length - 1}>›</button>
    </div>
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={e.id ?? ''} />
      <input type="hidden" name="category" value={e.category} />
      <input type="hidden" name="published" value={String(e.published)} />
      {/* Önizleme modunda da değerlerin gönderilmesi için */}
      {full && <>
        <input type="hidden" name="title" value={e.title} />
        <input type="hidden" name="entry_date" value={e.entry_date} />
        <input type="hidden" name="content" value={e.content} />
        <input type="hidden" name="sort_order" value={e.sort_order} />
      </>}

      <Link className="back" href="/yonetim/icerikler">← İçerikler</Link>
      <div className="ph">
        <div><h1>{full ? 'Önizleme' : heading}</h1><p className="sub">{full ? `${e.title || 'Başlıksız'} · okurun göreceği gibi, üç ekran boyutunda.` : sub}{dirty && !full ? ' · kaydedilmemiş değişiklik var' : ''}</p></div>
        <div className="acts">
          {full ? nav : null}
          <button type="button" className="btn" onClick={() => setFull(!full)}>{full ? 'Düzenlemeye dön' : 'Önizle'}</button>
          {!full && <button type="submit" name="intent" value="draft" className="btn" disabled={pending}>Taslak olarak kaydet</button>}
          {!full && e.id && <button type="submit" name="intent" value="save" className="btn" disabled={pending}>Kaydet</button>}
          <button type="submit" name="intent" value="publish" className="btn pri" disabled={pending}>{pending ? 'Kaydediliyor…' : e.published && e.id ? 'Yayında güncelle' : 'Yayınla'}</button>
        </div>
      </div>
      {state?.error && <div className="alertbar" role="alert">{state.error}</div>}

      {full ? (
        <div className="phones">
          {DEVICES.map(([w, h]) => (
            <figure key={w}>
              <Phone w={w} h={h} scale={0.6}><Page pg={pg} grainId={`g-pv-${w}`} /></Phone>
              <figcaption>{w} × {h}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="ed">
          <div>
            <div className="fld"><label className="lab" htmlFor="title">Başlık</label>
              <input id="title" name="title" className="inp ttl" type="text" value={e.title} maxLength={200} required onChange={(x) => set({ title: x.target.value })} /></div>
            <div className="row2">
              <div className="fld"><span className="lab" id="cat-l">Kategori</span>
                <div className="tabs" role="group" aria-labelledby="cat-l" style={{ alignSelf: 'flex-start' }}>
                  {([['siir', 'Şiir'], ['not', 'Not'], ['defter', 'Defter']] as const).map(([k, l]) => (
                    <button key={k} type="button" className={'tab' + (e.category === k ? ' on' : '')} aria-pressed={e.category === k} onClick={() => set({ category: k })}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="fld"><label className="lab" htmlFor="entry_date">Tarih</label>
                <input id="entry_date" name="entry_date" className="inp mono" type="date" value={e.entry_date} required onChange={(x) => set({ entry_date: x.target.value })} /></div>
            </div>
            <div className="fld">
              <label className="lab" htmlFor="content">Metin</label>
              <textarea id="content" name="content" className="inp ta" value={e.content} onChange={(x) => set({ content: x.target.value })}
                placeholder={e.category === 'siir' ? 'Her dize bir satır. Kıtalar arasında bir boş satır bırak.' : 'Paragraflar arasında bir boş satır bırak.'} />
              <span className="hint">
                {e.category === 'siir' ? 'Her satır bir dize; boş satır kıta arası.' : 'Boş satır paragraf arası.'} Uzun metinler sayfalara kendiliğinden bölünür. ·{' '}
                <b style={{ fontWeight: 500, color: '#1B1A17' }}>{pages.length} sayfa · {lines} satır · tahmini {secs >= 60 ? Math.round(secs / 60) + ' dk' : secs + ' sn'} okuma</b>
              </span>
            </div>
            <div className="row2">
              <div className="fld"><span className="lab" id="st-l">Yayın durumu</span>
                <div className="tabs" role="group" aria-labelledby="st-l" style={{ alignSelf: 'flex-start' }}>
                  <button type="button" className={'tab' + (!e.published ? ' on' : '')} aria-pressed={!e.published} onClick={() => set({ published: false })}>Taslak</button>
                  <button type="button" className={'tab' + (e.published ? ' on' : '')} aria-pressed={e.published} onClick={() => set({ published: true })}>Yayında</button>
                </div>
                <span className="hint">“Kaydet” bu seçimi uygular; “Yayınla” ve “Taslak” doğrudan belirler.</span>
              </div>
              <div className="fld"><label className="lab" htmlFor="sort_order">Aynı gün içindeki sıra</label>
                <input id="sort_order" name="sort_order" className="inp mono" type="number" min={-999} max={999} value={e.sort_order} onChange={(x) => set({ sort_order: Number(x.target.value) || 0 })} style={{ maxWidth: 120 }} />
                <span className="hint">Küçük sayı önce gelir. Genelde 0 kalır.</span>
              </div>
            </div>
            <button type="button" className="btn full mobonly" onClick={() => setFull(true)} style={{ marginBottom: 18 }}>Telefonda önizle</button>
            {children}
          </div>
          <aside className="pvcol" aria-label="Canlı önizleme">
            <div className="pvtoggle" role="group" aria-label="Ekran boyutu">
              {DEVICES.map(([w], i) => <button key={w} type="button" className={'btn sm' + (dev === i ? ' pri' : '')} onClick={() => setDev(i)}>{w}</button>)}
            </div>
            <Phone w={DEVICES[dev][0]} h={DEVICES[dev][1]} scale={0.72 * (390 / DEVICES[dev][0])}>
              <Page pg={pg} grainId="g-pv" />
            </Phone>
            {nav}
          </aside>
        </div>
      )}
    </form>
  );
}
