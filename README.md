# SEPYA

Kişisel şiir, not ve defter yayını. Okur PIN'le girer, adını yazar ve sayfaları kaydırarak okur. Arkada veri odaklı bir yönetim paneli vardır.

- **Okur tarafı:** `/` — PIN → isim → tam ekran okuma, menü, arşiv
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
- Yönetici girişi ayrı: e-posta + parola + TOTP (kimlik doğrulayıcı uygulama). 15 dk'da 5 hata → kilit. Tüm girişler loglanır.
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
   - QR kodu bir doğrulama uygulamasıyla tara, 6 haneli kodu yaz
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
