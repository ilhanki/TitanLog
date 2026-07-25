# TitanLog

> **Train. Track. Transform.**

TitanLog; antrenman, beslenme ve fiziksel gelişim verilerini tek bir mobil deneyimde takip etmeyi hedefleyen açık kaynaklı bir fitness uygulamasıdır. Proje erken alfa aşamasındadır ve aktif olarak geliştirilmektedir.

> [!IMPORTANT]
> Bu depo üretime hazır bir ürün sunmaz. Sprint 1 arayüzleri örnek veriler kullanır; gerçek hesap, antrenman kaydı veya kalıcı veri desteği henüz yoktur.

## Proje durumu

### Uygulanan Sprint 1 deneyimi

- `Ana Sayfa`, `Antrenman`, `Gelişim` ve `Profil` sekmelerinden oluşan Expo Router gezinmesi
- Android güvenli alanları ve gesture navigation ile uyumlu alt sekme çubuğu
- Ortak renk, aralık, tipografi, border, radius, shadow, ikon ve layout token'ları
- Tekrar kullanılabilir kart, buton, metin, input, ekran, progress ve empty-state bileşenleri
- Responsive, kaydırılabilir Türkçe ana panel
- Bugünkü program, istatistikler, Titan hedefi, son antrenman ve motivasyon bölümleri
- Typed demo veri kaynağından hesaplanan kilo hedefi ilerlemesi
- UI-only `Giriş Yap` ve `Kayıt Ol` ekranları
- Boş alan ve şifre eşleşmesi için küçük yerel form kontrolleri
- Gezinme, ana panel, hedef hesabı ve auth davranışlarını kapsayan smoke testleri

### Henüz desteklenmeyenler

- Gerçek kayıt, giriş, oturum veya şifre yenileme
- Backend, API çağrısı veya uzaktan veri
- SQLite veya başka bir kalıcı veri katmanı
- Antrenman oluşturma ya da kaydetme
- Beslenme takibi
- Gerçek veriye bağlı grafikler
- Bildirim, analytics veya sağlık platformu entegrasyonları

Formlara girilen bilgiler gönderilmez, saklanmaz ve oturum oluşturmaz. Geçerli form gönderimi yalnızca özelliğin geliştirme aşamasında olduğunu belirten bir bildirim gösterir.

## Ana paneldeki örnek veriler

Ana panel, yalnızca arayüz geliştirme ve test amacıyla yerel typed preview verisi kullanır. Örnek antrenman, kilo, hedef, seri ve hacim değerleri gerçek kullanıcı verisi değildir ve uygulama yeniden açıldığında kalıcı olmaz.

## Teknoloji yığını

- React Native 0.81
- React 19.1
- Expo SDK 54
- Expo Router 6
- TypeScript 5.9
- Jest ve React Native Testing Library
- ESLint ve Prettier

## Proje yapısı

```text
TitanLog/
├── __tests__/                    # Gezinme, ana panel, auth ve hesaplama testleri
├── app/
│   ├── (tabs)/                   # Dört ana alt sekme rotası
│   ├── auth/                     # Tab bar dışında kalan auth UI rotaları
│   └── _layout.tsx               # Kök Expo Router Stack
├── assets/images/                # Uygulama ikonu ve splash görselleri
├── src/
│   ├── components/               # Ortak mobil tasarım sistemi bileşenleri
│   ├── constants/                # Merkezi Türkçe metin kaynağı
│   ├── features/
│   │   ├── auth/                 # UI-only auth ekranları ve form kontrolleri
│   │   ├── home/                 # Ana panel, demo veri ve hedef hesabı
│   │   ├── profile/              # Profil ve hesap girişleri
│   │   ├── progress/             # Gelişim empty-state ekranı
│   │   └── workout/              # Antrenman empty-state ekranı
│   └── theme/                    # Paylaşılan tasarım token'ları
├── app.json                      # Expo uygulama yapılandırması
├── eslint.config.js              # ESLint flat config
├── package.json                  # Script'ler ve bağımlılıklar
└── tsconfig.json                 # Sıkı TypeScript ve yol eşleme ayarları
```

## Yerel kurulum

### Gereksinimler

- Node.js 20.19 veya üzeri
- npm
- Fiziksel cihaz testi için Expo SDK 54 ile uyumlu Expo Go

### Adımlar

```bash
git clone https://github.com/ilhanki/TitanLog.git
cd TitanLog
npm ci
npm start
```

Expo CLI çıktısındaki QR kodu Expo Go ile tarayabilir veya platform komutlarından birini kullanabilirsiniz. iOS geliştirme komutu macOS ve uygun iOS araç zinciri gerektirir.

## Kullanılabilir komutlar

| Komut                  | Açıklama                                           |
| ---------------------- | -------------------------------------------------- |
| `npm start`            | Expo geliştirme sunucusunu başlatır                |
| `npm run android`      | Android geliştirme hedefini açar                   |
| `npm run ios`          | iOS geliştirme hedefini açar                       |
| `npm run web`          | Web geliştirme hedefini açar                       |
| `npm run lint`         | Uygulama kaynaklarını ESLint ile denetler          |
| `npm run typecheck`    | TypeScript tür kontrolünü çalıştırır               |
| `npm test`             | Jest testlerini tek seferde çalıştırır             |
| `npm run format`       | Desteklenen dosyaları Prettier ile biçimler        |
| `npm run format:check` | Biçimlendirme tutarlılığını değiştirmeden denetler |

## Geliştirme ilkeleri

- Expo SDK 54 ve Expo Go uyumluluğu korunur.
- Kaynak kod adlandırmaları İngilizce, kullanıcı arayüzü metinleri Türkçedir.
- Ürün alanları `src/features` altında özellik odaklı tutulur.
- Görsel değerler ortak tasarım token'larından gelir.
- Özellikler küçük, doğrulanabilir ve Conventional Commits uyumlu değişikliklerle geliştirilir.
- Sırlar, kişisel veriler, yerel yapılandırmalar ve oluşturulan çıktılar depoya eklenmez.
- Erişilebilir etiketler, yeterli dokunma hedefleri, güvenli alanlar ve responsive düzen temel kabul edilir.

## Yol haritası

- **Sprint 0 — Proje temeli:** tamamlandı; metadata, kalite araçları, tema başlangıcı, test ve dokümantasyon
- **Sprint 1 — Gezinme ve ana deneyim:** tamamlandı; dört sekme, tasarım sistemi, ana panel ve UI-only auth
- **Sprint 2 — Antrenman planlama temeli:** egzersiz modeli, program görüntüleme ve yerel veri yaklaşımının tasarlanması
- **Gelecek sprint'ler:** kalıcı antrenman verisi, gelişim geçmişi ve beslenme alanlarının aşamalı geliştirilmesi

Yol haritası yön gösterir; tamamlanmamış özellikler için yayın taahhüdü değildir.

## Sürümleme

TitanLog [Semantic Versioning](https://semver.org/lang/tr/) yaklaşımını kullanır.

- Expo uygulama sürümü: `0.1.0`
- Paket ön sürümü: `0.1.0-alpha.1`
- Mevcut temel tag: `v0.1.0-alpha.0`
- Sprint 1 için planlanan tag: `v0.1.0-alpha.1`
- `alpha`: aktif erken geliştirme
- `beta`: özellikleri tamamlanmış test dönemi
- kararlı sürüm: üretime hazır yayın

Sprint 1 tag'i ve GitHub release henüz oluşturulmamıştır.

## Katkı durumu

Proje şu anda tek geliştiricili erken geliştirme aşamasındadır ve dış katkı süreci henüz açılmamıştır. Katkı rehberi ve issue şablonları süreç olgunlaştığında eklenecektir.

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

TitanLog aktif geliştirme altındadır. Belgelenmemiş davranışlar ve kırıcı değişiklikler erken alfa sürecinde görülebilir.
