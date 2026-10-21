import '@fontsource/pinyon-script/index.css';
import '@fontsource/special-elite/index.css';
import '@fontsource/unifrakturmaguntia/index.css';
import { CATS, type PageData } from '@/lib/pagination';

export function Grain({ id }: { id: string }) {
  return (
    <svg className="grain" aria-hidden="true">
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={3} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 .36  0 0 0 0 .27  0 0 0 0 .2  0 0 0 .6 0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/** Tek bir tam ekran sayfa. Okur tarafında ve yönetim önizlemesinde aynen kullanılır. */
export function Page({ pg, reader, grainId = 'g', onNext, hasNext, onNote }: { pg: PageData; reader?: string; grainId?: string; onNext?: () => void; hasNext?: boolean; onNote?: () => void }) {
  return (
    <div className="page">
      <div className="gutter" aria-hidden="true" />
      <div className="edges" aria-hidden="true" />
      <Grain id={grainId} />
      <div className="inner">
        <header>
          <span className="meta" style={{ letterSpacing: '.26em', fontSize: 10 }}>{pg.top}</span>
        </header>

        <div className={'pbody' + (pg.mid ? ' mid' : '') + (pg.kind === 'read' ? ' read' : '')}>
          {pg.kind === 'title' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span className="disp" style={{ fontSize: 54, fontWeight: 600, letterSpacing: '.26em', paddingLeft: '.26em', lineHeight: 1 }}>SEPYA</span>
              <span className="rule" aria-hidden="true" style={{ margin: '26px 0 20px' }} />
              <span className="disp" style={{ fontSize: 23, fontStyle: 'italic' }}>birkaç sayfa daha</span>
              {reader && <span style={{ marginTop: 76, fontSize: 17, fontStyle: 'italic', color: 'var(--soft)' }}>{reader} için.</span>}
              <span className="meta" style={{ marginTop: 10, fontSize: 9.5, letterSpacing: '.3em' }}>kimseye gösterme</span>
              <span className="meta" style={{ marginTop: 56, display: 'flex', alignItems: 'center', gap: 10, textTransform: 'none', letterSpacing: '.14em' }}>
                kaydırarak oku
                <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M22 5H2M6 1L2 5l4 4" /></svg>
              </span>
            </div>
          )}

          {pg.kind === 'section' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <h2 className="disp" style={{ margin: 0, fontSize: 42, fontWeight: 500, letterSpacing: '.16em', paddingLeft: '.16em', textTransform: 'uppercase', lineHeight: 1 }}>{pg.label}</h2>
              <span className="rule" aria-hidden="true" style={{ margin: '28px 0' }} />
              <p style={{ margin: 0, maxWidth: 240, fontSize: 18, fontStyle: 'italic', lineHeight: 1.6, color: 'var(--soft)' }}>{pg.epi}</p>
              <p className="meta" style={{ margin: '30px 0 0', textTransform: 'none', letterSpacing: '.14em' }}>{pg.countLabel}</p>
            </div>
          )}

          {pg.kind === 'empty' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span className="rule" aria-hidden="true" style={{ marginBottom: 30 }} />
              <p className="disp" style={{ margin: 0, fontSize: 34, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.1 }}>Henüz yazılmadı.</p>
              <p style={{ margin: '16px 0 0', maxWidth: 250, fontSize: 18, lineHeight: 1.6, color: 'var(--soft)' }}>Bu sayfalar şimdilik boş. Bir şeyler birikiyor; acele etmiyoruz.</p>
            </div>
          )}

          {pg.kind === 'cover' && (
            <div className={'cvr' + (pg.coverSrc ? '' : ' noimg')}>
              {pg.coverSrc && (
                <figure className="cvimg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pg.coverSrc} alt="" draggable={false} decoding="async" />
                </figure>
              )}
              <h1 className="disp cvtitle">{pg.title}</h1>
              <span className="rule" aria-hidden="true" style={{ margin: '22px 0 16px' }} />
              {pg.category && <span className="meta" style={{ letterSpacing: '.26em', fontSize: 9.5 }}>{CATS[pg.category].one}</span>}
            </div>
          )}

          {pg.kind === 'read' && (
            <article>
              <h1 className="disp ptitle">{pg.title}</h1>
              {pg.poem != null && <div className="poem">{pg.poem}</div>}
              {pg.paras && (
                <div className="prose">
                  {pg.paras.map((p, i) => <p key={i} className={p.cont ? 'cont' : undefined}>{p.t}</p>)}
                </div>
              )}
              {pg.initials && <p className={'inits i-' + (pg.initialsStyle ?? 'el')} aria-label={`İmza: ${pg.initials}`}>{pg.initials}</p>}
              <div className="rend">
                <span className="rule" aria-hidden="true" />
                {hasNext && onNext ? (
                  <button type="button" className="rnext" onClick={onNext}>sonraki yazı <ArrowR /></button>
                ) : (
                  <span className="rdone">Şimdilik hepsi bu.</span>
                )}
                {onNote && <button type="button" className="rnote" onClick={onNote}><Pen /> bir not bırak</button>}
              </div>
            </article>
          )}

          {pg.kind === 'entry' && (
            <div>
              {!pg.isFirst && (
                <p style={{ margin: '0 0 26px', fontSize: 15, fontStyle: 'italic', color: 'var(--soft)' }}>
                  {pg.title} <span className="meta" style={{ marginLeft: 6, letterSpacing: '.14em' }}>{pg.partLabel}</span>
                </p>
              )}
              {pg.isFirst && <h1 className="disp ptitle">{pg.title}</h1>}
              {pg.poem != null && <div className="poem">{pg.poem}</div>}
              {pg.paras && (
                <div className="prose">
                  {pg.paras.map((p, i) => <p key={i} className={p.cont ? 'cont' : undefined}>{p.t}</p>)}
                </div>
              )}
              {pg.hasMore && <p style={{ margin: '22px 0 0', textAlign: 'right', fontSize: 15, fontStyle: 'italic', color: 'var(--soft)' }}>devamı →</p>}
            </div>
          )}
        </div>

        <footer>
          <span className="meta" style={{ fontSize: 11, letterSpacing: '.22em', fontVariantNumeric: 'tabular-nums' }}>{pg.counter}</span>
        </footer>
      </div>
    </div>
  );
}

export const Dots = () => (
  <svg width="20" height="4" viewBox="0 0 20 4" aria-hidden="true">
    <circle cx="2" cy="2" r="1.3" fill="currentColor" /><circle cx="10" cy="2" r="1.3" fill="currentColor" /><circle cx="18" cy="2" r="1.3" fill="currentColor" />
  </svg>
);
export const ArrowR = () => (
  <svg width="24" height="10" viewBox="0 0 24 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M0 5h22M18 1l4 4-4 4" /></svg>
);
export const Lock = () => (
  <svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true"><rect x="2" y="8" width="12" height="9" rx="1.5" /><path d="M5 8V5.5a3 3 0 0 1 6 0V8" /><path d="M8 11.5v2" /></svg>
);
export const Close = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true"><path d="M2 2l12 12M14 2L2 14" /></svg>
);
export const ArrowL = () => (
  <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M22 5H2M6 1L2 5l4 4" /></svg>
);
export const Pen = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11.2 2.3l2.5 2.5L5.5 13H3v-2.5z" /><path d="M9.6 3.9l2.5 2.5" /><path d="M2.5 15h11" /></svg>
);
