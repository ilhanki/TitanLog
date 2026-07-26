# TitanLog

> **Train. Track. Transform.**

TitanLog, antrenman ve fiziksel gelişim takibini tek bir Android öncelikli mobil deneyimde buluşturmayı hedefleyen açık kaynaklı bir fitness uygulamasıdır. Proje erken alfa aşamasındadır ve aktif olarak geliştirilmektedir.

> [!IMPORTANT]
> Bu depo üretime hazır bir ürün sunmaz. Sprint 2 ile antrenman kaydı cihaz üzerinde kalıcı hâle gelmiştir; hesap, bulut yedekleme, cihazlar arası eşitleme ve kalıcı vücut ölçümleri henüz yoktur.

## Proje durumu

### Sprint 2 — Çevrimdışı antrenman takibi

- Expo SQLite ile tek cihazda çevrimdışı antrenman planı ve oturum saklama
- `PRAGMA user_version` tabanlı, sıralı ve tekrar çalıştırılabilir migrasyon sistemi
- Her açılışta güvenle kontrol edilen idempotent Titan Başlangıç Programı seed'i
- Cihazın yerel gününe göre bugünün programı ve Cuma dinlenme durumu
- Program günü detayı, egzersiz sırası, varsayılan set/tekrar/kilo değerleri
- Tek aktif oturum kuralı ve uygulama yeniden açıldığında oturuma devam etme
- Set kilosu ve tekrar girişi, set tamamlama, güvenli set ekleme/kaldırma
- Yerel geçmişi koruyan antrenman tamamlama ve iptal akışları
- Tamamlanan set, toplam tekrar ve antrenman hacmi özeti
- Ana sayfada gerçek bugünkü program, aktif oturum, spor günü sayısı ve son antrenman
- Android klavye yeniden boyutlandırması ve alt güvenli alan çözümünün korunması

Sprint 1'de eklenen dört sekmeli Expo Router gezinmesi, Türkçe ana panel, UI-only hesap ekranları ve ortak tasarım sistemi kullanılmaya devam eder.

## Yerel veritabanı

Veritabanı adı `titanlog.db`, güncel şema sürümü `1`'dir. Uygulama kökündeki tek `SQLiteProvider`, açılış sırasında yabancı anahtar denetimini etkinleştirir, WAL kipini ister, migrasyonları sırayla çalıştırır ve ardından varsayılan programı seed eder. Başlatma başarısız olursa uygulama sahte veriye geçmez; Türkçe hata ve yeniden deneme durumu gösterir.

Şema şu tabloları içerir:

- `workout_plans`
- `workout_days`
- `workout_day_schedules`
- `exercises`
- `workout_day_exercises`
- `workout_sessions`
- `workout_session_exercises`
- `workout_sets`

Çalışma zamanı değerleri bağlı SQL parametreleriyle yazılır. Çok adımlı seed, oturum başlatma, set ekleme/kaldırma ve tamamlama işlemleri transaction içinde yürütülür. Geçmiş oturumlar, gelecekte program değişse bile eski kaydı korumak için antrenman ve egzersiz snapshot'ları taşır.

## Varsayılan program

`Titan Başlangıç Programı` tek aktif plan olarak eklenir:

| Günler                | Program         | Egzersiz |
| --------------------- | --------------- | -------- |
| Pazartesi ve Perşembe | Sırt + Biceps   | 7        |
| Salı ve Cumartesi     | Göğüs + Triceps | 6        |
| Çarşamba ve Pazar     | Bacak + Omuz    | 7        |
| Cuma                  | Dinlenme        | —        |

Her egzersiz 3 set ve 10 hedef tekrar ile başlar. Kilo değerleri kilogram olarak sayısal saklanır. Dambıl egzersizlerindeki değer `her el` olarak açıkça gösterilir. Sprint 2 hacim hesabı, girilen her-el kilosunu sessizce ikiyle çarpmaz; tamamlanan setler için `kilo × gerçek tekrar` toplamını kullanır.

## Oturum yaşam döngüsü

Antrenman başlatıldığında program ve egzersizler transaction içinde snapshot'lanır, varsayılan set satırları oluşturulur ve oturum `active` olur. Veritabanı kısıtı ile uygulama kontrolü birlikte ikinci bir aktif oturumu engeller.

Kilo ve tekrar değişiklikleri input düzenlemesi bittiğinde, tamamlama durumu ise düğmeye basıldığında yazılır. Tamamlanan bir set geçerli kilo ve sıfırdan büyük gerçek tekrar gerektirir. Oturumu bitirmek için en az bir tamamlanmış set gerekir. İptal edilen oturum silinmez, normal tamamlanan geçmişine ve spor günü sayısına katılmaz.

## Ana panel verileri

Şu alanlar gerçek SQLite verisidir:

- bugünün programı veya dinlenme durumu
- aktif oturum ve `Antrenmana Devam Et` eylemi
- tamamlanan spor günü sayısı
- son tamamlanan antrenman, ilk üç egzersizi, set sayısı ve hacmi

Başlangıç kilosu, güncel kilo, hedef kilo ve hedef ilerlemesi Sprint 2 kapsamı dışında olduğu için yalnızca açıkça izole edilmiş arayüz önizleme verisidir; veritabanına kaydedilmez ve kullanıcı tarafından saklanmış veri olarak sunulmaz.

## Desteklenmeyen özellikler

- Gerçek kayıt, giriş, çoklu kullanıcı veya şifre yenileme
- Backend, bulut yedekleme veya cihazlar arası eşitleme
- Program ve egzersiz kütüphanesi düzenleme
- Kalıcı vücut ölçümü ve beslenme takibi
- Sağlık platformu, bildirim, analytics veya sosyal özellikler
- Şifreli veritabanı, SQLCipher veya ORM

## Android ve web durumu

Android Expo Go, Sprint 2'nin birincil çalışma hedefidir. Metro başlangıcı ve SDK bağımlılık uyumu otomatik olarak doğrulanır; Sprint 2'nin kalıcılık akışları Samsung Galaxy A55 üzerinde ayrıca fiziksel cihaz kontrolü gerektirir.

Statik web export, Expo SQLite WASM asset'i için resmi asgari Metro yapılandırmasıyla üretilir. Expo SQLite'ın web desteği alfa durumundadır; tarayıcıda kalıcılık çalışma zamanı doğrulanmadığından web, Sprint 2 için veri güvenilirliği kaynağı değildir ve sahte web persistence katmanı kullanılmaz.

## Teknoloji yığını

- React Native 0.81
- React 19.1
- Expo SDK 54 ve Expo Router 6
- Expo SQLite 16
- TypeScript 5.9
- Jest ve React Native Testing Library
- ESLint ve Prettier

## Proje yapısı

```text
TitanLog/
├── __tests__/                         # Migrasyon, seed, repository, ekran ve yardımcı testleri
├── app/
│   ├── (tabs)/                        # Dört ana alt sekme
│   ├── auth/                          # UI-only hesap rotaları
│   ├── workout/                       # Gün, aktif oturum ve özet rotaları
│   └── _layout.tsx                    # SQLiteProvider içeren kök Stack
├── src/
│   ├── components/                    # Ortak mobil tasarım sistemi
│   ├── constants/                     # Merkezi Türkçe metinler
│   ├── database/
│   │   ├── migrations/                # user_version tabanlı şema adımları
│   │   └── seed/                      # İdempotent varsayılan program
│   ├── features/
│   │   ├── home/                      # SQLite bağlantılı ana panel
│   │   └── workouts/                  # Domain, repository, hook, ekran ve yardımcılar
│   └── theme/                         # Paylaşılan tasarım token'ları
├── app.json                           # Expo uygulama ve build sürümleri
├── metro.config.js                    # Expo SQLite web WASM asset ayarı
└── package.json                       # Komutlar ve bağımlılıklar
```

## Yerel kurulum

### Gereksinimler

- Node.js 20.19 veya üzeri
- npm
- Fiziksel Android kontrolü için Expo SDK 54 ile uyumlu Expo Go

```bash
git clone https://github.com/ilhanki/TitanLog.git
cd TitanLog
npm ci
npm start
```

Expo CLI çıktısındaki QR kodu Expo Go ile tarayabilirsiniz. iOS komutu macOS ve uygun iOS araç zinciri gerektirir.

## Kullanılabilir komutlar

| Komut                            | Açıklama                                      |
| -------------------------------- | --------------------------------------------- |
| `npm start`                      | Expo Metro geliştirme sunucusunu başlatır     |
| `npm run android`                | Android hedefini açar                         |
| `npm run ios`                    | iOS hedefini açar                             |
| `npm run web`                    | Web geliştirme hedefini açar                  |
| `npm run typecheck`              | Sıkı TypeScript kontrolünü çalıştırır         |
| `npm run lint`                   | Kaynakları ESLint ile denetler                |
| `npm run format:check`           | Prettier tutarlılığını değiştirmeden denetler |
| `npm test -- --runInBand`        | Testleri tek süreçte çalıştırır               |
| `npx expo-doctor`                | Expo proje sağlığını denetler                 |
| `npx expo export --platform web` | Statik web çıktısını doğrular                 |

## Sürümleme

TitanLog [Semantic Versioning](https://semver.org/lang/tr/) yaklaşımını kullanır.

- Paket ön sürümü: `0.1.0-alpha.3`
- Expo uygulama sürümü: `0.1.0`
- Android `versionCode`: `1`
- iOS `buildNumber`: `1`
- Planlanan Sprint 2 tag'i: `v0.1.0-alpha.3`

Planlanan tag, GitHub Release veya Pull Request bu geliştirme adımında oluşturulmaz.

## Yol haritası

- **Sprint 0 — Proje temeli:** tamamlandı
- **Sprint 1 — Gezinme ve ana deneyim:** tamamlandı
- **Sprint 2 — Antrenman alanı ve yerel kalıcılık:** uygulandı; fiziksel cihaz doğrulaması bekliyor
- **Önerilen Sprint 3 — Ölçüm geçmişi:** kalıcı vücut ölçümleri, ölçüm girişi ve sade ilerleme görünümü

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

TitanLog aktif geliştirme altındadır. Erken alfa sürecinde kırıcı değişiklikler görülebilir.
