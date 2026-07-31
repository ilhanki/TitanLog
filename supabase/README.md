# TitanLog Supabase kurulumu

Bu klasör Sprint 9'un isteğe bağlı hesap ve manuel özel bulut yedeği altyapısını içerir. Canlı eşitleme yapmaz.

1. Supabase projesinde `migrations/202607310001_accounts_and_backups.sql` dosyasını uygulayın.
2. Authentication e-posta/şifre sağlayıcısını yapılandırın. Redirect URL listesine `titanlog://auth/callback` ve `titanlog://auth/reset-password` adreslerini ekleyin.
3. `delete-account` Edge Function'ını deploy edin. `SUPABASE_URL`, `SUPABASE_ANON_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` yalnız Edge Function ortamında bulunmalıdır.
4. Uygulamada `.env.example` dosyasını `.env` olarak kopyalayıp yalnız proje URL'si ile istemciye açık anon/publishable anahtarı girin.

Bucket public değildir. Storage politikaları kullanıcının yalnız `<auth.uid()>/latest.titanlog` nesnesine erişmesine izin verir. Service-role anahtarı mobil uygulamaya, README'ye veya yedek dosyasına konmaz.

Gerçek bulut yükleme, indirme, e-posta gönderimi ve hesap silme davranışı deploy edilmiş bir Supabase projesinde ayrıca doğrulanmalıdır.
