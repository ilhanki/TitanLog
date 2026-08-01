# Manuel cihaz eşitleme

TitanLog yerel, misafir öncelikli ve çevrimdışı çalışır. Cihaz eşitleme hesap açmayı zorunlu kılmaz; yalnız oturum açmış ve yerel veri kümesinin sahipliğini açıkça onaylamış kullanıcı tarafından başlatılır. Arka plan, realtime, girişte otomatik sync veya kayıt bazlı merge yoktur.

## Neden tam veri kümesi revizyonu?

Antrenman, set, program, geçmiş snapshot'ı ve vücut ölçümleri ilişkisel bir bütündür. TitanLog her senkronizasyonda mevcut katı `.titanlog` sözleşmesinden deterministik bir fitness-data snapshot'ı üretir. Aynı geçerli veri aynı UTF-8 baytlarını ve SHA-256 özetini verir. Kimlik doğrulama oturumu, token'lar ve yerel `sync_state` bu arşive girmez.

Her kabul edilen gönderim private Storage'da değişmez bir revizyon nesnesi oluşturur. Tek uzak başlık geçerli revizyonu, özeti, boyutu ve arşiv sürümlerini gösterir. Push, istemcinin gördüğü revizyonla sunucudaki revizyon aynıysa ilerler; stale cihaz sessizce yeni verinin üzerine yazamaz. Aynı operation ID ile güvenli tekrar uzak revizyonu ikinci kez ilerletmez.

## Karar ve çatışma kuralları

- Bulut boşsa yerel özet gösterilir ve ilk upload açıkça onaylanır.
- Yerel ve bulut değişmediyse ağ yazması yapılmaz.
- Yalnız yerel değiştiyse mevcut uzak revizyon beklenerek push onayı istenir.
- Yalnız bulut değiştiyse yeniden indirilen arşiv doğrulanır ve yerel replace açıkça onaylanır.
- İki taraf da değiştiyse otomatik son-yazan-kazan uygulanmaz. Yalnız `Bu cihazdaki verileri kullan`, `Buluttaki verileri kullan` ve `Vazgeç` seçenekleri sunulur.
- Offline, hesap süresi dolmuş, sahipliksiz veya hesap uyuşmazlığı durumlarında fitness verisi değişmez ve otomatik retry döngüsü başlamaz.

Bulut verisini kullanmak boyut, hash, biçim, desteklenen sürüm, değer ve bütün ilişki doğrulamalarını tekrar çalıştırır. Başlık onay sırasında değişmişse akış çatışmaya döner. Geçerli arşiv tek exclusive SQLite transaction içinde replace edilir; foreign-key denetimi veya herhangi bir yazma başarısızsa işlem tamamen geri alınır.

## İlişki bütünlüğü ve geriye uyumluluk

Yerel yedek, manuel bulut yedeği ve cihaz sync'i aynı saf TypeScript arşiv doğrulama çekirdeğini kullanır. Mevcut backup sözleşmesinin kabul ettiği tarihsel `workout_session_exercises` ilişkileri korunur; gerçek orphan child kayıtları reddedilir. Tam snapshot silmeleri taşıdığı için sync silinmiş parent kayıtlarını yeniden üretmez ve geçerli tarihsel child kayıtlarını sessizce atmaz.

Yerel SQLite migration sürümü `5`'tir. Sync bookkeeping'i fitness tablolarından ayrı `sync_state` kaydındadır. `.titanlog` arşiv biçimi `1`, fitness veri şeması `4` kalır; migration 5 öncesi Samsung Galaxy A55 üzerinde oluşturulmuş geçerli şema-4 arşivleri restore edilebilir.

## Kurtarma arşivi

Buluttan yerel replace başlamadan önce mevcut yerel veri kümesi yeniden oluşturulup doğrulanan bir `.titanlog` kurtarma arşivi olarak uygulamanın private belge alanına yazılır. En fazla bir önceki pre-sync kopyası tutulur, otomatik yüklenmez ve içeriği loglanmaz. Yeni kopya eski kopyanın yerini alır; cleanup hatası aktif veritabanı transaction'ını yarım bırakmaz. Hesap ve Veri ekranından kurtarma kopyası dışa aktarılabilir veya restore akışına alınabilir.

## Manuel bulut yedeğinden farkı

| Özellik          | Yerel yedek           | Manuel bulut yedeği       | Cihaz eşitleme                       |
| ---------------- | --------------------- | ------------------------- | ------------------------------------ |
| Başlatma         | Kullanıcı             | Kullanıcı                 | Kullanıcı                            |
| Hedef            | Sistem paylaşım akışı | Private `latest.titanlog` | Private değişmez revizyonlar         |
| Uzak başlık/CAS  | Yok                   | Yok                       | Var                                  |
| Çatışma algılama | Uygulanmaz            | Uygulanmaz                | Var                                  |
| Otomatik çalışma | Hayır                 | Hayır                     | Hayır                                |
| Recovery kopyası | Restore önizlemesi    | Restore önizlemesi        | Yıkıcı pull öncesi tek private kopya |

Bir sync hatası manuel bulut yedeğini değiştirmez. Manuel yedek de sync başlığına otomatik dönüştürülmez.

## Gizlilik ve günlükleme

Normal arayüz hash, UUID, object path, signed URL veya native hata göstermez. Güvenli geliştirme tanıları yalnız aşama, revizyon, hash eşitliği, byte boyutu, platform, güvenli hata kodu ve HTTP durum sınıfıyla sınırlıdır. Arşiv JSON'u, tam hash, e-posta, kullanıcı/kurulum kimliği, token, notlar ve fitness değerleri loglanmaz.

## Çevrimdışı davranış ve sınırlamalar

Fitness özellikleri ve yerel yedek çevrimdışı çalışmaya devam eder. Sync açık bir offline sonucu döndürür, veri silmez, sahte başarı göstermez ve kullanıcı yeniden denemeden ağ isteğini yinelemez. İlk sürüm tam snapshot kullandığı için çok büyük veri kümelerinde kayıt bazlı sync'ten daha fazla veri aktarabilir. Çoklu kullanıcı ortak düzenleme, PT–sporcu ilişkisi ve background sync kapsam dışıdır.

## Gerçek ortam operatör kontrol listesi

- [ ] Supabase Auth e-posta/şifre ve iki redirect URL yapılandırıldı.
- [ ] SQL migration'ları dosya sırasıyla uygulandı.
- [ ] `titanlog-backups` ve `titanlog-sync` private; public/anon erişim yok.
- [ ] `sync-pull`, `sync-push`, sonra güncel `delete-account` deploy edildi.
- [ ] Service-role yalnız Edge Function secret ortamında.
- [ ] İki izole hesapla çapraz metadata/list/download reddi doğrulandı.
- [ ] İki cihaz veya cihaz+emülatörle ilk push, pull, tek taraflı değişiklik ve conflict denendi.
- [ ] Stale revision ve aynı operation ID tekrarları doğrulandı.
- [ ] Bozuk/hash yanlış/desteklenmeyen arşiv yereli veya aktif başlığı değiştirmedi.
- [ ] Hesap silme tüm sync kaynaklarını kaldırdı; cleanup hatası silmeyi durdurdu.
- [ ] Manuel bulut yedeği ile yerel export/restore regresyonu geçti.
- [ ] Samsung Galaxy A55'te gesture/üç tuş, TalkBack ve 360–412 dp yerleşimleri doğrulandı.

Gerçek kurulum komutları, deploy sırası, iki hesap testi ve rollback ayrıntıları için [`../supabase/README.md`](../supabase/README.md) dosyasına bakın.
