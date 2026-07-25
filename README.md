# TitanLog

> **Train. Track. Transform.**

TitanLog; antrenman, beslenme ve fiziksel gelişim verilerini tek bir mobil deneyimde takip etmeyi hedefleyen açık kaynaklı bir fitness uygulamasıdır. Proje şu anda erken alfa aşamasındadır ve aktif olarak geliştirilmektedir.

> [!IMPORTANT]
> Bu depo üretime hazır bir ürün sunmaz. Henüz yalnızca uygulama temeli, mühendislik standartları ve Sprint 0 karşılama ekranı uygulanmıştır.

## Proje durumu

### Şu anda uygulanmış olanlar

- Expo SDK 54 ve TypeScript tabanlı uygulama temeli
- Expo Router giriş yapısı
- Türkçe, güvenli alan uyumlu temel ekran
- Koyu tema için ortak tasarım token'ları
- Merkezi Türkçe metin kaynağı
- ESLint, Prettier, sıkı TypeScript ve Jest kontrolleri
- React Native Testing Library ile temel ekran smoke testi

### Planlanan temel özellikler

- Antrenman planlama ve egzersiz kaydı
- Beslenme ve makro takibi
- Vücut ölçümleri ve ilerleme geçmişi
- Hedefler, özetler ve anlaşılır gelişim grafikleri
- Yerel ve çevrimdışı öncelikli veri deneyimi

Bu özellikler henüz uygulanmamıştır.

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
├── __tests__/                 # Uygulama temeli testleri
├── app/                       # Expo Router rotaları ve kök yerleşim
├── assets/images/             # Uygulama ikonu ve açılış görselleri
├── src/
│   ├── components/            # Yeniden kullanılabilir arayüz bileşenleri
│   ├── constants/             # Merkezi uygulama metinleri ve sabitler
│   └── theme/                 # Renk, aralık, tipografi ve kenar token'ları
├── app.json                   # Expo uygulama yapılandırması
├── eslint.config.js           # ESLint flat config
├── package.json               # Script'ler ve bağımlılıklar
└── tsconfig.json              # Sıkı TypeScript ve yol eşleme ayarları
```

Yeni ürün alanları geliştikçe `src/features` altında özellik odaklı modüller oluşturulacaktır. Servisler, hook'lar, durum yönetimi, veri katmanı, türler ve yardımcı işlevler yalnızca gerçek bir kullanım ortaya çıktığında eklenecektir.

## Yerel kurulum

### Gereksinimler

- Node.js 20.19 veya üzeri
- npm
- Fiziksel cihaz testi için Expo Go'nun Expo SDK 54 ile uyumlu sürümü

### Adımlar

```bash
git clone https://github.com/ilhanki/TitanLog.git
cd TitanLog
npm ci
npm start
```

Expo CLI çıktısındaki QR kodu Expo Go ile tarayabilir veya platform komutlarından birini kullanabilirsiniz. iOS geliştirme komutu macOS ve uygun iOS araç zinciri gerektirir.

## Kullanılabilir komutlar

| Komut                  | Açıklama                                        |
| ---------------------- | ----------------------------------------------- |
| `npm start`            | Expo geliştirme sunucusunu başlatır             |
| `npm run android`      | Android geliştirme hedefini açar                |
| `npm run ios`          | iOS geliştirme hedefini açar                    |
| `npm run web`          | Web geliştirme hedefini açar                    |
| `npm run lint`         | Uygulama kaynaklarını ESLint ile denetler       |
| `npm run typecheck`    | TypeScript tür kontrolünü çalıştırır            |
| `npm test`             | Jest testlerini tek seferde çalıştırır          |
| `npm run format`       | Desteklenen dosyaları Prettier ile biçimler     |
| `npm run format:check` | Biçimlendirme tutarlılığını değiştirmeden sınar |

## Geliştirme ilkeleri

- Expo SDK 54 ve Expo Go uyumluluğu korunur.
- Uygulama kodundaki adlandırmalar İngilizce, kullanıcı arayüzü metinleri Türkçedir.
- Özellikler küçük, doğrulanabilir ve Conventional Commits uyumlu değişikliklerle geliştirilir.
- Sırlar, kişisel veriler, yerel yapılandırmalar ve oluşturulan çıktılar depoya eklenmez.
- Gereksiz soyutlamalar ve kullanılmayan bağımlılıklar eklenmez.
- Erişilebilirlik, güvenli alanlar ve ortak tasarım token'ları temel kabul edilir.

## Yol haritası

- **Sprint 0 — Proje temeli:** metadata, kalite araçları, tema, Türkçe temel ekran, test ve dokümantasyon
- **Sprint 1 — Uygulama iskeleti:** bilgi mimarisi, temel gezinme ve ortak arayüz parçaları
- **Gelecek sprint'ler:** antrenman, beslenme, ilerleme ve yerel veri özelliklerinin aşamalı geliştirilmesi

Yol haritası yön gösterir; tamamlanmış özellik taahhüdü değildir.

## Sürümleme

TitanLog [Semantic Versioning](https://semver.org/lang/tr/) yaklaşımını kullanır.

- Uygulama sürümü: `0.1.0`
- Paket ön sürümü: `0.1.0-alpha.0`
- Planlanan ilk tag: `v0.1.0-alpha.0`
- `alpha`: aktif erken geliştirme
- `beta`: özellikleri tamamlanmış test dönemi
- kararlı sürüm: üretime hazır yayın

Henüz bir tag veya GitHub release oluşturulmamıştır.

## Katkı durumu

Proje şu anda tek geliştiricili erken temel aşamasındadır ve dış katkı süreci henüz açılmamıştır. Katkı rehberi ve issue şablonları süreç olgunlaştığında eklenecektir.

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

TitanLog aktif geliştirme altındadır. Belgelenmemiş davranışlar ve kırıcı değişiklikler erken alfa sürecinde görülebilir.
