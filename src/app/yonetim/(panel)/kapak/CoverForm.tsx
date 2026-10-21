'use client';

import { useActionState, useState } from 'react';
import { Page } from '@/components/reader/Page';
import { Phone } from '@/components/admin/EntryEditor';
import { COVER_DEFAULT, COVER_LIMITS, type CoverText } from '@/lib/cover';
import type { PageData } from '@/lib/pagination';
import { saveCoverAction, type FormState } from '../../actions';
import '@/components/reader/reader.css';

const FIELDS: [keyof CoverText, string, string][] = [
  ['title', 'Başlık', 'Büyük harflerle en üstte.'],
  ['subtitle', 'Alt satır', 'Başlığın altında, italik.'],
  ['dedication', 'Okura hitap', '{isim} yazdığın yere okurun adı gelir. Ör. “{isim}, hoş geldin.”'],
  ['note', 'Küçük not', 'Küçük, aralıklı büyük harflerle.'],
  ['hint', 'En alttaki ipucu', 'Yanında ← oku görünür.']
];

const PREVIEW: PageData = { key: 'acilis', kind: 'title', top: '21 EKİM 2026', counter: '', mid: true };

export default function CoverForm({ initial }: { initial: CoverText }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCoverAction, undefined);
  const [c, setC] = useState<CoverText>(initial);
  const dirty = JSON.stringify(c) !== JSON.stringify(initial);

  return (
    <form action={action} className="ed">
      <div>
        {state?.error && <div className="alertbar" role="alert">{state.error}</div>}
        {state?.ok && !dirty && <div className="okbar" role="status">{state.ok}</div>}
        {FIELDS.map(([k, label, hint]) => (
          <div className="fld" key={k}>
            <label className="lab" htmlFor={k}>{label}</label>
            <input id={k} name={k} className="inp" value={c[k]} maxLength={COVER_LIMITS[k]} autoComplete="off"
              placeholder="(boş: gösterilmez)" onChange={(e) => setC({ ...c, [k]: e.target.value })} />
            <span className="hint">{hint}</span>
          </div>
        ))}
        <div className="acts" style={{ marginTop: 8 }}>
          <button className="btn pri" type="submit" disabled={pending}>{pending ? 'Kaydediliyor…' : 'Kaydet'}</button>
          <button className="btn" type="button" onClick={() => setC(COVER_DEFAULT)}>İlk hâline döndür</button>
          <button className="btn" type="button" onClick={() => setC({ ...c, subtitle: '', dedication: '', note: '', hint: '' })}>Yalnızca başlık</button>
        </div>
      </div>
      <aside className="pvcol" aria-label="Canlı önizleme">
        <Phone w={390} h={844} scale={0.72}><Page pg={PREVIEW} reader="Eren" cover={c} grainId="g-kapak" /></Phone>
        <p className="hint" style={{ textAlign: 'center' }}>Önizlemede okur adı “Eren”.</p>
      </aside>
    </form>
  );
}
