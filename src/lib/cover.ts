/** Açılış (kapak) sayfasındaki yazılar. Boş bırakılan satır gösterilmez. */
export interface CoverText {
  title: string;      // büyük başlık
  subtitle: string;   // başlığın altındaki italik satır
  dedication: string; // okura hitap; {isim} okurun adıyla değişir
  note: string;       // küçük büyük harfli satır
  hint: string;       // en alttaki ipucu (ok işaretiyle)
}

export const COVER_DEFAULT: CoverText = {
  title: 'SEPYA',
  subtitle: 'birkaç sayfa daha',
  dedication: '{isim} için.',
  note: 'kimseye gösterme',
  hint: 'kaydırarak oku'
};

export const COVER_LIMITS: Record<keyof CoverText, number> = { title: 24, subtitle: 80, dedication: 80, note: 60, hint: 40 };

export function parseCover(raw: string | null | undefined): CoverText {
  if (!raw) return COVER_DEFAULT;
  try {
    const o = JSON.parse(raw) as Partial<CoverText>;
    const out = { ...COVER_DEFAULT };
    for (const k of Object.keys(COVER_DEFAULT) as (keyof CoverText)[]) {
      if (typeof o[k] === 'string') out[k] = o[k]!.slice(0, COVER_LIMITS[k]);
    }
    return out;
  } catch {
    return COVER_DEFAULT;
  }
}
