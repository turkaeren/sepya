# SEPYA

Kişisel şiir, not ve defter yayını. Okur PIN'le girer, adını yazar ve sayfaları kaydırarak okur. Arkada veri odaklı bir yönetim paneli vardır.

- **Okur tarafı:** `/` — isim → şifre (PIN) → tam ekran okuma. Sağ üstte gezinme çubuğu (≡ Yazılar + kilit), sağ kenarda zaman çizgisi; yazılar yeniden eskiye.
- **Yönetim:** `/yonetim` — genel bakış, analitik, ziyaretçiler, başarısız denemeler, içerikler (canlı telefon önizlemeli editör), güvenlik
- **İlk kurulum:** `/yonetim/kurulum` — yalnızca hiç yönetici yokken açılır

## Yapı

| Katman | Seçim |
| --- | --- |
| Uygulama | Next.js 15 (App Router), TypeScript |
| Veritabanı | Supabase Postgres (`supabase/migrations`) |
| Barındırma | Vercel (önerilen) |

Tarayıcı veritabanına hiç bağlanmaz. Tüm tablolarda RLS açık ve politika yok; uygulama yalnızca sunucuda, `SUPABASE_SERVICE_ROLE_KEY` ile bağlanır. İçerik, yalnızca geçerli bir okur oturumu varken sunucuda sayfaya gömülür; herkese açık bir içerik adresi yoktur.

## Güvenlik

- Okur PIN'i ve yönetici parolası **argon2id** ile özetlenir; düz hali hiçbir yerde tutulmaz.
- Başarısız denemelerde PIN değeri kaydedilmez; yalnızca zaman, IP, ülke/şehir, cihaz, tarayıcı ve sonuç yazılır.
- Kaba kuvvet koruması (`src/lib/pin.ts`):
  - 5 ardışık hata → 30 sn bekleme
  - aynı IP'den 15 dk'da 8 hata → IP 15 dk engel
  - aynı IP'den 24 sa'te 20 hata → IP 24 sa engel
  - tüm IP'lerden 15 dk'da 60 hata → herkese 60 sn bekleme (dağıtık deneme)
- Oturum çerezleri `HttpOnly`, `Secure`, `SameSite=Strict`. Veritabanında yalnızca çerezin SHA-256 özeti durur. Okur oturumu 12 saat, 30 dk hareketsizlikte biter.
- Yönetici girişi ayrı: e-posta + parola. Aynı IP'den 15 dk'da 5 hata → 15 dk kilit; aynı hesaba saatte 10 hata → 1 sa kilit. Tüm girişler loglanır.
- Yönetim panelinden okur oturumu sonlandırma, tümünü sonlandırma, IP engelleme/kaldırma, PIN değiştirme (değişince tüm okur oturumları kapanır).
- API rotaları yalnızca aynı kökenden gelen istekleri kabul eder; sunucu eylemleri Next.js'in köken denetiminden geçer.
- Güvenlik başlıkları: CSP, HSTS, `X-Frame-Options: DENY`, `noindex`.

## Yayına alma (Vercel)

1. Bu depoyu Vercel'de **Add New → Project** ile içe aktar.
2. **Environment Variables** bölümüne ekle:
   - `SUPABASE_URL` = `https://boimfjkqcqlvjvpbvokh.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase › Project Settings › API Keys › `service_role` (ya da `secret`) anahtarı
   - `SETUP_TOKEN` = en az 16 karakterlik rastgele bir değer (ör. `openssl rand -base64 24`)
3. Deploy et.
4. `https://<alan-adın>/yonetim/kurulum` adresini aç:
   - `SETUP_TOKEN`'ı gir
   - yönetici e-postası ve parolasını belirle
   - okurların gireceği 4 haneli PIN'i belirle
5. Kurulum bitince sayfa kendiliğinden kapanır. İstersen `SETUP_TOKEN`'ı Vercel'den silebilirsin.

Konum bilgisi (ülke/şehir) Vercel'in `x-vercel-ip-country` ve `x-vercel-ip-city` başlıklarından gelir. Başka bir sunucuda bu alanlar boş kalır, her şey yine çalışır.

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env.local   # değerleri doldur
npm run dev                  # http://localhost:3000
```

## Veritabanı

Şema `supabase/migrations` altında. `sepya` Supabase projesine zaten uygulandı:

- `0001_init.sql`
- `0003_admin_functions.sql`
- `supabase/seed.sql` (12 örnek içerik)

`0002_privacy.sql` (30 günden eski IP'lerin son hanesini silen fonksiyon) henüz uygulanmadı. Supabase SQL Editor'de bir kez çalıştırman yeterli. Yönetim paneli her açıldığında bu fonksiyonu çağırır; fonksiyon yoksa sessizce atlar.

## İçerik kuralları

- **Şiir:** her satır bir dize, boş satır kıta arası. Tek satırlık kıtalar (ör. `II.`) sonraki kıtayla aynı sayfada kalır.
- **Not / Defter:** boş satır paragraf arası.
- Uzun metinler sayfalara otomatik bölünür (`src/lib/pagination.ts`). Yönetimdeki önizleme de okur tarafıyla aynı kuralı kullanır.

## Son güncellemeler

- **Kapak yazıları:** Yönetim › Kapak'tan düzenleniyor. Değerler `settings` tablosunda, `cover_text` anahtarında JSON olarak duruyor (`src/lib/cover.ts`, `cover-store.ts`). Boş satır gösterilmez, `{isim}` okurun adıyla değişir.
- **Kaynak, notlar, baş harf** (migration `0005_source_notes_initials.sql`, uygulandı):
  - **Nereden geldi:** `src/lib/source.ts` → `detectSource()`.
    - Bakılan ipuçları: utm_source/kaynak etiketi, igsh/fbclid/gclid, uygulama içi tarayıcı user-agent'ı ve document.referrer. Gate ilk açılışta bunları alır, `/api/pin` ile gönderir.
    - Kayıt yerleri: `reader_sessions.source` / `source_ref` (yalnızca alan adı) ve `pin_attempts.source`.
    - Gösterildiği yerler: Analitik › “Nereden geldiler”, Ziyaretçiler ve Başarısız denemelerdeki “Kaynak” sütunu.
    - Bağlantıya `?kaynak=isim` eklenirse o adla sayılır.
  - **Okur notu:** okur arayüzünde sağ üstteki kalem ya da yazı sonundaki “bir not bırak” (`NoteSheet.tsx`).
    - `/api/note`: okur oturumu şart; saatte 6, günde 20 not.
    - Notlar `reader_notes` tablosunda durur. Yönetim › Notlar'da okunmamış rozetiyle görünür; sayfa açılınca okundu sayılır.
  - **Baş harf:** `entries.initials` (≤12) ve `initials_style` (el | daktilo | gotik).
    - Yazının sonunda sağ altta görünür.
    - Fontlar @fontsource ile sitede barındırılıyor: Pinyon Script, Special Elite, UnifrakturMaguntia.
    - Editörde alan ve yazı tipi seçimi var; yeni yazıda son kullanılan değer gelir.
- **2ae1923:** Okuma ve kapak görselleri.
  - Bir yazı artık tek sayfada aşağı kaydırılarak okunuyor; yazılar arasında başlık/görsel geçiş sayfası var.
  - Yönetimde başlık (kapak) görseli yüklenebiliyor: Supabase Storage'da özel `covers` alanı, JPEG/PNG/WebP, en fazla 3 MB.
  - Görsel yalnızca oturumla `/api/cover/[id]` üzerinden veriliyor.
- **c03b2c2 / aa5bb1a:** Editörde yalnızca **Taslak** ve **Yayınla** düğmeleri var. Kaydet düğmesi ve durum seçici kaldırıldı; bu, var olan yazının yayınlanmaması hatasını da düzeltti.
- **9e6d445:** Okur ekranında sağ üstte tıklanabilir gezinme çubuğu: "≡ Yazılar" listeyi açar, yanında kilit var. Liste açıkken çubuk gizlenir. Sınıflar `.topnav` ve `.tnav` (eski `.menu` ile çakışmasın diye `.tmenu`).
- **83010c3:** Yönetim → İçerikler → **WordPress’ten al** (`src/lib/wp-import.ts`, `importAction`).
  - Kaynak WordPress.com herkese açık API'si ya da WordPress dışa aktarma .xml dosyası.
  - Başlık, tarih ve metin gelir; görseller atılır.
  - Şiir ya da düzyazı olduğu kendiliğinden ayrılır.
  - "Önce mevcut içeriği sil" seçeneği var; silme yalnızca aktarma alınabildiyse yapılır.
  - Server action gövde sınırı 20 MB.
- **f81e758:** Yönetici girişi yalnızca e-posta + parola; TOTP kaldırıldı. Hesap bazlı kilit: saatte 10 hata → 1 sa.
- **Önce isim sonra şifre:**
  - Başarısız denemeler isimle loglanır (`pin_attempts.name`, migration 0004).
  - Saçma isimler `src/lib/name.ts` → `checkName()` ile reddedilir.
- **Sağ panel:** Yazılar aya göre gruplu, yeniden eskiye (PostsPanel).
