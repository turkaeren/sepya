'use client';

/** Sunucu tarafı bir hata olursa (ör. veritabanı geçici olarak kapalı) sade bir sayfa gösterir. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', background: '#0E0C0A', color: '#E4D8C3', fontFamily: "'EB Garamond', Georgia, serif" }}>
      <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '.24em', paddingLeft: '.24em' }}>SEPYA</div>
      <p style={{ margin: '18px 0 28px', fontSize: 19, fontStyle: 'italic', color: '#9D907F', maxWidth: 300 }}>Sayfalar şu an açılmıyor. Birazdan yeniden dene.</p>
      <button type="button" onClick={reset} style={{ padding: '12px 24px', border: '1px solid #4A4038', borderRadius: 24, background: 'none', color: '#E4D8C3', fontSize: 14, letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer' }}>Yeniden dene</button>
    </main>
  );
}
