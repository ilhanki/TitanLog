# TitanLog Supabase işletim kılavuzu

Bu klasör isteğe bağlı hesap, manuel özel bulut yedeği ve revizyonlu manuel cihaz eşitleme altyapısını içerir. Uygulamanın misafir ve çevrimdışı kullanımı Supabase gerektirmez. Bu dosyaların depoda bulunması, gerçek bir Supabase projesine deploy edildikleri anlamına gelmez.

## Güvenlik sınırı

- Mobil uygulama yalnız `EXPO_PUBLIC_SUPABASE_URL` ile anon/publishable anahtarı alır.
- `SUPABASE_SERVICE_ROLE_KEY` yalnız Edge Function secret'ı olabilir; uygulama paketine, `.env.example` dosyasına veya loglara girmez.
- `titanlog-backups` ve `titanlog-sync` bucket'ları private kalır. Public URL kullanılmaz.
- Yetki, arşiv içeriğindeki kimlikten değil doğrulanmış `auth.uid()` değerinden türetilir.
- Manuel yedek `<uid>/latest.titanlog` nesnesini kullanır. Eşitleme ise `<uid>/revisions/<revision>-<sha256>.titanlog` biçimindeki değişmez nesneleri ve atomik uzak başlığı kullanır; bu iki akış birbirine dönüştürülmez.
- PostgreSQL ile Storage tek fiziksel transaction paylaşmaz. Push önce değişmez nesneyi yazar, sonra veritabanındaki başlığı compare-and-swap ile ilerletir; başlık güncellemesi başarısızsa aktif başlık korunur ve yüklenen sahipsiz nesne best-effort silinir.

## Gelecekteki gerçek kurulum sırası

Bu adımlar operatör içindir; bu repository hazırlığında çalıştırılmamıştır.

1. Yeni veya izole bir Supabase projesi oluşturun ve yerel CLI'ı o projeye bağlayın.
2. Authentication altında e-posta/şifre sağlayıcısını ve e-posta doğrulama politikasını belirleyin.
3. Redirect URL listesine tam olarak şunları ekleyin:
   - `titanlog://auth/callback`
   - `titanlog://auth/reset-password`
4. SQL migration'larını dosya sırasıyla uygulayın:
   - `202607310001_accounts_and_backups.sql`
   - `202608010001_revisioned_device_sync.sql`
5. SQL sonucunda `titanlog-backups` ve `titanlog-sync` bucket'larının private olduğunu, RLS'nin etkin olduğunu ve anonymous/public policy bulunmadığını denetleyin.
6. Edge Function secret'larını Supabase kontrol düzleminde tanımlayın; değerleri terminal çıktısına veya kaynak dosyaya yazmayın.
7. Edge Function'ları aşağıdaki sırayla deploy edin:
   - `sync-pull`
   - `sync-push`
   - `delete-account`
8. Uygulamanın takip edilmeyen yerel `.env` dosyasına yalnız public proje URL'sini ve anon/publishable anahtarını yazın.
9. [`../docs/manual-device-sync.md`](../docs/manual-device-sync.md) kabul planını iki izole hesap ve iki cihazla tamamlayın.

Örnek operatör komutları:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase secrets set SUPABASE_URL=<url> SUPABASE_ANON_KEY=<anon-key> SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
supabase functions deploy sync-pull
supabase functions deploy sync-push
supabase functions deploy delete-account
```

Yer tutucuları gerçek değerlerle yalnız güvenli operatör ortamında değiştirin. Komut geçmişi veya CI logu secret saklamaya uygun değilse platformun secret yönetimini kullanın.

## Deploy sonrası zorunlu kontroller

### İki hesapla RLS izolasyonu

1. A ve B hesaplarını ayrı oturumlarda oluşturun.
2. A ile manuel yedek ve ilk sync revizyonu yazın.
3. B ile A'nın Storage nesnesini listeleme, indirme veya metadata satırını okuma denemelerinin reddedildiğini doğrulayın.
4. İstek gövdesine A'nın kullanıcı kimliğini eklemenin B'ye yetki vermediğini doğrulayın.
5. Signed URL'nin private, kısa ömürlü ve yalnız çağıranın nesnesine ait olduğunu doğrulayın.
6. Service-role değerinin mobil bundle ve ağ isteklerinde bulunmadığını denetleyin.

### İki cihazla eşitleme

1. Cihaz A'da mevcut veri kümesinin sahipliğini açıkça onaylayın ve ilk revizyonu gönderin.
2. Cihaz B'de aynı hesapla oturum açıp boş/uygun yerel veri üzerine açık onayla çekin.
3. Yalnız A'da değişiklik yapıp push; yalnız B'de uzak değişiklik varken pull senaryolarını doğrulayın.
4. İki cihazda aynı tabandan değişiklik yaparak çatışma üretin ve üç seçeneği ayrı ayrı sınayın.
5. Eski beklenen revizyonla push'ın `409`/typed conflict döndürdüğünü ve otomatik overwrite olmadığını doğrulayın.
6. Aynı operation ID ile tekrarın tek mantıksal revizyon oluşturduğunu doğrulayın.
7. Bozuk, büyük, hash'i yanlış ve desteklenmeyen arşivlerin aktif başlığı veya yerel veriyi değiştirmediğini doğrulayın.

### Hesap silme

1. Test hesabında manuel yedek, sync başlığı, operation metadata ve en az iki revision oluşturun.
2. Yakın tarihli oturumla hesap silmeyi başlatın.
3. Tüm özel nesnelerin ve metadata'nın silindiğini, sonra Auth hesabının kaldırıldığını doğrulayın.
4. Uzak cleanup aşamasını kontrollü olarak başarısız kılın; Auth hesabının ve yerel fitness verisinin sessizce silinmediğini doğrulayın.

## Rollback rehberi

- Edge Function hatasında son çalışan function sürümünü yeniden deploy edin; aktif sync başlığını elle ilerletmeyin.
- Yeni push'ları geçici durdurmak için function veya yetkisini devre dışı bırakın; private bucket'ı public yapmayın ve RLS'yi kapatmayın.
- Migration'lar forward-only kabul edilir. Yayınlanmış dosyayı değiştirmek yerine düzeltici yeni migration hazırlayın.
- Başlık yanlış bir revizyona işaret ediyorsa önce audit ve immutable nesne bütünlüğünü doğrulayın; kontrollü düzeltme için yedek alın ve iki kişi incelemesi kullanın.
- Cihaz pull'undan önce üretilen tek yerel kurtarma arşivi otomatik olarak buluta yüklenmez. Kullanıcı bu kopyayı dışa aktarabilir veya geri yükleyebilir.
- Manuel `latest.titanlog` yedeği sync rollback mekanizması değildir ve sync metadata'sıyla birleştirilmemelidir.

## Gerçek ortam durumu

SQL/RLS, Edge Function ve istemci akışları yerel statik/mocked testler için hazırlanmıştır. Gerçek Auth, Storage, RLS izolasyonu, Edge Function, iki cihaz eşitlemesi ve hesap silme doğrulaması deploy edilmiş bir test projesinde ayrıca yapılmalıdır.
