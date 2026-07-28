# TitanLog

> **Train. Track. Transform.**

TitanLog, antrenman ve fiziksel gelişim takibini tek bir Android öncelikli mobil deneyimde buluşturmayı hedefleyen açık kaynaklı bir fitness uygulamasıdır. Proje erken alfa aşamasındadır ve aktif olarak geliştirilmektedir.

> [!IMPORTANT]
> Bu depo üretime hazır bir ürün sunmaz. Antrenmanlar ve vücut ölçümleri tek cihazda yerel olarak saklanır; hesap, bulut yedekleme ve cihazlar arası eşitleme henüz yoktur.

## Proje durumu

### Sprint 5 — Antrenman geçmişi ve oturum detayları

- Tamamlanan antrenmanları en yeniden eskiye gösteren sayfalı, salt-okunur geçmiş ekranı
- Program ve egzersiz snapshot'larını koruyan ayrıntılı oturum görünümü
- Tamamlanan set, tekrar, süre ve hacim özetleri
- Aynı program günündeki bir önceki tamamlanmış oturumla tarafsız fark karşılaştırması
- Eksik zaman bilgisini tahmin üretmeden açıkça belirten süre gösterimi
- Workout ve ana paneldeki son antrenman alanlarından geçmiş detayına doğrudan geçiş

### Sprint 4 — Kompakt antrenman tablosu

- Düşük parlaklıklı siyah/kömür yüzeyler ve ince ayırıcılarla sadeleştirilmiş antrenman ekranları
- Bütün egzersizleri aynı anda gösteren, egzersiz başına tek kalıcı satırlı aktif antrenman tablosu
- Önceden doldurulmuş ve düzenlenebilir kilo/tekrar alanları, canlı set sayacı ve satır içi tamamlama
- Tamamlanan egzersizi yerinde tutan, yalnızca işlem yapılan satırı bekleten hızlı set akışı
- Tamamlanan setleri düzenleyen; değer devralarak set ekleyen ve yalnızca son tamamlanmamış seti kaldıran kompakt düzenleyici
- Uygulama yeniden açıldığında aktif oturumun, sayaçların ve sıradaki set değerlerinin geri yüklenmesi

### Sprint 3 — Vücut gelişimi ve ölçüm geçmişi

- Kişisel değer seed etmeden yerel başlangıç ve hedef kilo kurulumu
- Kilo, isteğe bağlı çevre ölçümleri ve 250 karakterlik not kaydı
- En yeni ölçümün güncel kilo olarak kullanıldığı düzenlenebilir ölçüm geçmişi
- İlk/tek ölçümü koruyan destructive onaylı silme akışı
- Kilo verme ve kilo alma hedeflerini destekleyen yön duyarlı ilerleme hesabı
- Başlangıç, güncel, hedef, kalan, toplam değişim ve önceki ölçüm farkı
- Progress sekmesinde gerçek özet, geçmiş, yeni ölçüm ve hedef ayarları
- Ana sayfadaki bütün vücut değerlerinin gerçek SQLite verisine bağlanması
- Profil yokken örnek sayı yerine hedef kurulum çağrısı

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

Veritabanı adı `titanlog.db`, güncel şema sürümü `3`'tür. Uygulama kökündeki tek `SQLiteProvider`, açılış sırasında yabancı anahtar denetimini etkinleştirir, WAL kipini ister, migrasyonları sırayla çalıştırır ve ardından varsayılan programı seed eder. Var olan v2 kurulumlarında yalnızca migration v3 uygulanır; gelecekte oluşturulacak oturumların program varsayılanı 12 tekrara yükseltilirken geçmiş, iptal edilmiş ve aktif oturum setleri ile bütün vücut verileri korunur. Başlatma başarısız olursa uygulama sahte veriye geçmez; Türkçe hata ve yeniden deneme durumu gösterir.

Şema şu tabloları içerir:

- `workout_plans`
- `workout_days`
- `workout_day_schedules`
- `exercises`
- `workout_day_exercises`
- `workout_sessions`
- `workout_session_exercises`
- `workout_sets`
- `body_profiles`
- `body_measurements`

Çalışma zamanı değerleri bağlı SQL parametreleriyle yazılır. Çok adımlı seed, oturum başlatma, set ekleme/kaldırma ve tamamlama işlemleri transaction içinde yürütülür. Geçmiş oturumlar, gelecekte program değişse bile eski kaydı korumak için antrenman ve egzersiz snapshot'ları taşır. Sprint 5 geçmiş sorguları bu mevcut snapshot'ları ve tamamlanmış oturum indeksini kullandığı için şema sürümü `3` olarak kalır; yeni migrasyon gerekmez.

## Varsayılan program

`Titan Başlangıç Programı` tek aktif plan olarak eklenir:

| Günler                | Program         | Egzersiz |
| --------------------- | --------------- | -------- |
| Pazartesi ve Perşembe | Sırt + Biceps   | 7        |
| Salı ve Cumartesi     | Göğüs + Triceps | 6        |
| Çarşamba ve Pazar     | Bacak + Omuz    | 7        |
| Cuma                  | Dinlenme        | —        |

Her egzersiz 3 set ve 12 hedef tekrar ile başlar. Yeni oturumlarda gerçek tekrar alanı da 12 ile önceden doldurulur; bu değer set tamamlanana kadar toplam tekrar veya hacme katılmaz. Kilo değerleri kilogram olarak sayısal saklanır. Dambıl egzersizlerindeki değer `her el` olarak açıkça gösterilir. Hacim hesabı, girilen her-el kilosunu sessizce ikiyle çarpmaz; tamamlanan setler için `kilo × gerçek tekrar` toplamını kullanır.

## Oturum yaşam döngüsü

Antrenman başlatıldığında program ve egzersizler transaction içinde snapshot'lanır, varsayılan set satırları oluşturulur ve oturum `active` olur. Veritabanı kısıtı ile uygulama kontrolü birlikte ikinci bir aktif oturumu engeller.

Kilo ve tekrar değişiklikleri input düzenlemesi bittiğinde, tamamlama durumu ise düğmeye basıldığında yazılır. Tamamlanan bir set geçerli kilo ve sıfırdan büyük gerçek tekrar gerektirir. Oturumu bitirmek için en az bir tamamlanmış set gerekir. İptal edilen oturum silinmez, normal tamamlanan geçmişine ve spor günü sayısına katılmaz.

Aktif antrenmanda her egzersiz tek satırda kalır. Satır, sıradaki tamamlanmamış setin kilo ve tekrar değerlerini gösterir; tamamlama sonrasında sayaç yerinde güncellenir ve sonraki set son girilen değerleri devralır. Bütün setler tamamlandığında satır kaldırılmaz, tamamlandı durumu metin ve simgeyle belirtilir. Set sayacına dokunulduğunda açılan kompakt düzenleyicide tamamlanan setler değiştirilebilir, son setin değerlerini devralan yeni bir set eklenebilir ve yalnızca son tamamlanmamış set güvenle kaldırılabilir.

Tamamlanan oturum geçmişi salt okunurdur. Geçmiş listesi yalnızca `completed` durumundaki oturumları gösterir; ayrıntı ekranı oturum ve egzersiz snapshot'larını, bütün set satırlarını ve yalnızca tamamlanmış setlerden hesaplanan toplamları sunar. Karşılaştırma, aynı program gününün en yakın önceki tamamlanmış oturumunu kullanır. Dambıl hacminde kayıtlı her-el kilosu bir kez sayılır; sessizce ikiyle çarpılmaz. Süre veya önceki karşılaştırma verisi yoksa arayüz tahminde bulunmaz.

## Vücut profili ve ölçümler

Profil kurulumu başlangıç ve hedef kilosunu doğrular, singleton `body_profiles` kaydını ve başlangıç kilosunu taşıyan ilk `body_measurements` kaydını tek transaction içinde oluşturur. Başlangıç ve hedef aynı olamaz. Kilo aralığı 20–400 kg, isteğe bağlı çevre ölçümleri 20–300 cm'dir; hem virgül hem nokta ondalık ayırıcı kabul edilir.

Ölçümler en yeniden eskiye sıralanır, düzenlenebilir ve uygun olduğunda silinebilir. Profilin başlangıç temelini koruyan ilk ölçüm ile tek kalan ölçüm silinemez. Hedef ayarları değiştirildiğinde geçmiş ölçümler yeniden yazılmaz; ilerleme yeni başlangıç/hedef değerlerine göre yeniden hesaplanır.

Kilo verme ilerlemesi `(başlangıç - güncel) / (başlangıç - hedef)`, kilo alma ilerlemesi `(güncel - başlangıç) / (hedef - başlangıç)` olarak hesaplanır ve 0–1 aralığında sınırlandırılır.

## Ana panel verileri

Şu alanlar gerçek SQLite verisidir:

- bugünün programı veya dinlenme durumu
- aktif oturum ve `Antrenmana Devam Et` eylemi
- tamamlanan spor günü sayısı
- son tamamlanan antrenman, ilk üç egzersizi, set sayısı ve hacmi
- güncel, başlangıç ve hedef kilo ile hedefe kalan mesafe
- gerçek vücut hedefi ilerlemesi

Vücut profili yoksa hiçbir örnek kişisel ölçüm gösterilmez; kullanıcı Progress kurulumuna yönlendirilir.

## Desteklenmeyen özellikler

- Gerçek kayıt, giriş, çoklu kullanıcı veya şifre yenileme
- Backend, bulut yedekleme veya cihazlar arası eşitleme
- Program ve egzersiz kütüphanesi düzenleme
- Beslenme, boy, BMI veya kalori önerileri
- Sağlık platformu, bildirim, analytics veya sosyal özellikler
- Şifreli veritabanı, SQLCipher veya ORM

## Android ve web durumu

Android Expo Go birincil çalışma hedefidir. Sprint 2, Sprint 3 ve Sprint 4 akışları Samsung Galaxy A55 üzerinde fiziksel olarak doğrulandı. Sprint 5 antrenman geçmişi ve oturum detayları için fiziksel cihaz doğrulaması henüz yapılmadı.

Statik web export, Expo SQLite WASM asset'i için resmi asgari Metro yapılandırmasıyla üretilir. Expo SQLite'ın web desteği alfa durumundadır; tarayıcıda kalıcılık çalışma zamanı doğrulanmadığından web veri güvenilirliği kaynağı değildir ve sahte web persistence katmanı kullanılmaz.

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
│   ├── progress/                      # Ölçüm ekleme, düzenleme ve hedef rotaları
│   ├── workout/                       # Gün, aktif oturum, özet ve geçmiş rotaları
│   └── _layout.tsx                    # SQLiteProvider içeren kök Stack
├── src/
│   ├── components/                    # Ortak mobil tasarım sistemi
│   ├── constants/                     # Merkezi Türkçe metinler
│   ├── database/
│   │   ├── migrations/                # user_version tabanlı şema adımları
│   │   └── seed/                      # İdempotent varsayılan program
│   ├── features/
│   │   ├── body/                      # Profil, ölçüm, hesaplama ve form akışları
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

- Paket ön sürümü: `0.1.0-alpha.6`
- Expo uygulama sürümü: `0.1.0`
- Android `versionCode`: `1`
- iOS `buildNumber`: `1`
- Yayımlanan Sprint 4 tag'i: `v0.1.0-alpha.5`
- Planlanan Sprint 5 tag'i: `v0.1.0-alpha.6`

Planlanan tag, GitHub Release veya Pull Request bu geliştirme adımında oluşturulmaz.

## Yol haritası

- **Sprint 0 — Proje temeli:** tamamlandı
- **Sprint 1 — Gezinme ve ana deneyim:** tamamlandı
- **Sprint 2 — Antrenman alanı ve yerel kalıcılık:** yayımlandı ve fiziksel cihazda doğrulandı
- **Sprint 3 — Vücut gelişimi ve ölçüm geçmişi:** yayımlandı ve fiziksel cihazda doğrulandı
- **Sprint 4 — Kompakt antrenman tablosu:** yayımlandı ve fiziksel cihazda doğrulandı
- **Sprint 5 — Antrenman geçmişi ve oturum detayları:** yerel olarak uygulandı; fiziksel cihaz doğrulaması ve yayın onayı bekliyor

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

TitanLog aktif geliştirme altındadır. Erken alfa sürecinde kırıcı değişiklikler görülebilir.
