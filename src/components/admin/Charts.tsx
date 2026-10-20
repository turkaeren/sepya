// Sade, editoryal grafikler. Sunucuda üretilir; JavaScript gerektirmez.

export interface Bar { v: number; l: string; hi?: boolean; title?: string }

const pct = (v: number, max: number) => (max > 0 ? Math.max(v > 0 ? 2 : 0, Math.round((v / max) * 100)) : 0) + '%';

export function Bars({ data, height = 170, accent = false, showValues = true, gap = 6 }: { data: Bar[]; height?: number; accent?: boolean; showValues?: boolean; gap?: number }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="bars" style={{ height, gap }} role="img" aria-label={data.map((d) => `${d.l || ''} ${d.v}`).join(', ')}>
      {data.map((d, i) => (
        <div className="bar" key={i} title={d.title ?? `${d.l}: ${d.v}`}>
          <span className="bv">{showValues && d.v > 0 ? d.v : ''}</span>
          <div className="trk"><span className={'bf' + (accent || d.hi ? ' ac' : '')} style={{ height: pct(d.v, max) }} /></div>
          <span className="bl">{d.l}</span>
        </div>
      ))}
    </div>
  );
}

export function PairBars({ data, height = 170 }: { data: { a: number; b: number; l: string }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b)));
  return (
    <div className="bars" style={{ height }} role="img" aria-label={data.map((d) => `${d.l}: ${d.a} başarılı, ${d.b} başarısız`).join('; ')}>
      {data.map((d, i) => (
        <div className="bar" key={i} title={`${d.l}: ${d.a} / ${d.b}`}>
          <span className="bv">{d.a || d.b ? `${d.a}·${d.b}` : ''}</span>
          <div className="pair"><span className="bf" style={{ height: pct(d.a, max) }} /><span className="bf ac" style={{ height: pct(d.b, max) }} /></div>
          <span className="bl">{d.l}</span>
        </div>
      ))}
    </div>
  );
}

export function StackBars({ data, height = 170 }: { data: { a: number; b: number; l: string }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.a + d.b));
  return (
    <div className="bars" style={{ height }} role="img" aria-label={data.map((d) => `${d.l}: ${d.a} yeni, ${d.b} tekrar`).join('; ')}>
      {data.map((d, i) => (
        <div className="bar" key={i} title={`${d.l}: ${d.a} yeni, ${d.b} tekrar`}>
          <span className="bv">{d.a + d.b || ''}</span>
          <div className="trk"><span className="bf lt" style={{ height: pct(d.b, max) }} /><span className="bf" style={{ height: pct(d.a, max) }} /></div>
          <span className="bl">{d.l}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ data, unit = '', empty = 'Henüz veri yok.' }: { data: { k: string; n: number }[]; unit?: '%' | ''; empty?: string }) {
  if (!data.length || data.every((d) => d.n === 0)) return <p className="hint" style={{ margin: 0 }}>{empty}</p>;
  const total = data.reduce((s, d) => s + d.n, 0);
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div>
      {data.map((d) => (
        <div className="hr" key={d.k}>
          <span className="lb">{d.k}</span>
          <span className="vl">{unit === '%' ? '%' + Math.round((d.n / total) * 100) : d.n}</span>
          <div className="tk"><div className="fl" style={{ width: Math.round((d.n / max) * 100) + '%' }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Line({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  const n = Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [Math.round((i * 700) / n), Math.round(160 - (v / max) * 145)]);
  const line = pts.map((p) => p.join(',')).join(' ');
  const area = `M0,170 L${pts.map((p) => p.join(',')).join(' L')} L700,170 Z`;
  const step = Math.max(1, Math.floor(labels.length / 4));
  return (
    <div className="line">
      <svg viewBox="0 0 700 170" preserveAspectRatio="none" role="img" aria-label={values.map((v, i) => `${labels[i]}: ${v}`).join(', ')}>
        <path d={area} fill="#EFEBE3" />
        <polyline points={line} fill="none" stroke="#1B1A17" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="xl">{labels.filter((_, i) => i % step === 0 || i === labels.length - 1).map((l, i) => <span key={i}>{l}</span>)}</div>
    </div>
  );
}

export function Kpi({ l, v, n, alert, small }: { l: string; v: string | number; n?: string; alert?: boolean; small?: boolean }) {
  return (
    <div className={'kpi' + (alert ? ' alert' : '')}>
      <div className="kl">{l}</div>
      <div className={'kv' + (small ? ' sm' : '')}>{v}</div>
      {n && <div className="kn">{n}</div>}
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="rule" />
      <p className="et">{title}</p>
      <p className="ed2">{text}</p>
      {children}
    </div>
  );
}

export function Status({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    active: ['on', 'Aktif'], expired: ['off', 'Sona erdi'], revoked: ['rv', 'Sonlandırıldı'],
    pin_changed: ['off', 'PIN değişti'], logout: ['off', 'Çıktı'], ended: ['off', 'Sona erdi']
  };
  const [cls, label] = map[s] ?? ['off', s];
  return <span className={'st ' + cls}><i />{label}</span>;
}

export const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M9 2l7.5 13h-15z" /><path d="M9 7v4M9 13v.5" /></svg>
);
