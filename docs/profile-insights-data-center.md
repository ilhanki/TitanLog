# Profil, İçgörüler ve Veri Merkezi

Sprint 13, TitanLog'un misafir-öncelikli ve yerel-öncelikli temelini değiştirmeden profil deneyimini kişiselleştirir. Hesap açmak zorunlu değildir; görünen ad, haftalık hedefler, birim tercihi ve misafir profil fotoğrafı uygulamanın özel yerel alanında kalır.

## Profil kimliği

- Görünen ad 2–40 karakter arasında olmalı; baştaki/sondaki boşluklar ve art arda boşluklar normalize edilir.
- Ad yoksa `Titan Sporcusu` kullanılır. E-posta adresinin kullanıcı adı otomatik profil adına dönüştürülmez.
- Fotoğraf seçimi JPEG, PNG ve WebP kaynaklarını kabul eder; kaynak 8 MB ile sınırlıdır.
- Seçilen görsel kare kırpılır, 512 × 512 JPEG'e dönüştürülür ve özgün tam çözünürlüklü dosya saklanmaz.
- Misafir fotoğrafı kendiliğinden yüklenmez. Hesaplı kullanıcı açıkça kaydettiğinde fotoğraf sahip-korumalı özel Storage alanına yüklenir.
- Profil medyası `.titanlog` fitness yedeklerine ve cihaz eşitleme arşivlerine dahil edilmez.

Yeni medya paketleri native modül içerdiğinden Sprint 13 fiziksel testi için yeni bir development build kurulmalıdır.

## Dönemsel içgörüler

Hafta Pazartesi günü, ay takvim ayının ilk günü, yıl 1 Ocak tarihinde yerel saatle başlar. Dönem sonu dışlayıcıdır; böylece sınırdaki bir kayıt iki döneme birden girmez.

İçgörüler kaynak antrenman ve ölçüm satırlarından sorgu anında türetilir. Haftalık, aylık veya yıllık toplamlar ayrı bir kaynak olarak saklanmaz.

- Yalnız `completed` oturumlar ve tamamlanmış setler sayılır.
- Hacim, tamamlanmış setlerin `kayıtlı ağırlık × gerçek tekrar` toplamıdır.
- `per_hand` kayıtları mevcut TitanLog sözleşmesine uygun olarak ikinci kez çarpılmaz.
- Ek ağırlığı sıfır olan vücut ağırlığı hareketleri hacme sıfır ekler.
- Dönemsel kilo değişimi ilk ve son geçerli ölçüm arasındaki farktır. En az iki ölçüm yoksa karşılaştırma yapılmaz.
- Kilo değişimi tıbbi veya değer yargılı bir sonuca dönüştürülmez.
- Pound gösterimi, kilogram olarak saklanan kanonik değerlerden yalnız sunum sırasında hesaplanır.
- Önceki dönem sıfırsa yanıltıcı yüzde değişimi gösterilmez.

Grafikler yalnız gerçek antrenman günlerini/bucket'larını gösterir; eksik günler arasında sahte ölçüm veya yumuşatılmış eğri üretmez.

## Veri ve Yedekleme

`Veri ve Yedekleme` üç farklı işi açıkça ayırır:

1. Yerel `.titanlog` dışa aktarma ve doğrulanmış geri yükleme,
2. isteğe bağlı tek özel bulut yedeği,
3. kullanıcı tarafından başlatılan revizyonlu cihaz eşitleme.

Ekranı açmak yükleme, geri yükleme, sahiplik talebi veya eşitleme başlatmaz. Sahipsiz veri yalnız açık onayla hesaba bağlanır. Hesap uyuşmazlığında uzak işlemler engellenir. Geri yükleme ve eşitleme korumaları, fitness yedeği biçim sürümü 4 ve mevcut ilişki doğrulama sözleşmesini korur.

Son 20 veri işleminin türü, sonucu ve zamanı yerel bir listede tutulur. Bu liste e-posta, kullanıcı kimliği, nesne yolu, token, arşiv içeriği veya fitness verisi içermez; temizlenebilir ve yedeklenmez/eşitlenmez.

## Gizlilik ve bilinen sınırlar

- Profil Storage bucket'ı public değildir; sahip klasörü dışında okuma/yazma RLS ile engellenir.
- Kalıcı public URL üretilmez. Uzak migration bu görevde yalnız yerel olarak hazırlanmıştır ve deploy edilmemiştir.
- Profil medyası yüklemesinde yüzde tabanlı ağ ilerlemesi Supabase JS Storage API tarafından güvenilir biçimde sağlanmadığından arayüz aşama tabanlı durum gösterir.
- Analiz sorguları cihazdaki yerel SQLite geçmişini kullanır. Çok büyük gerçek cihaz veri kümeleri için fiziksel performans ölçümü beklemektedir.
- Bildirim özelliği eklenmemiştir; uygulama Sprint 13 kapsamında bildirim izni istemez.
