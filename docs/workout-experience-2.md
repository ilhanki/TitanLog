# Workout Experience 2.0

Sprint 14, aktif antrenman akışını tek elle daha hızlı ve uygulama kapanmalarına karşı dayanıklı hâle getirir. Bu belge `0.1.0-alpha.13` yerel geliştirme kapsamındaki davranışları ve sınırları açıklar.

## Dinlenme zamanlayıcısı

Zamanlayıcının kaynağı azalan bir sayaç değil, SQLite içinde saklanan mutlak bitiş zamanıdır. Kalan süre her ekranda bu tarihten türetilir; arka plana geçme, yeniden çizim ve uygulamayı yeniden açma sayaç kaymasına yol açmaz. Aynı anda yalnız bir zamanlayıcı aktiftir. Set tamamlandığında otomatik başlayabilir; kullanıcı 30, 60, 90, 120 veya 180 saniyeyi, özel bir süreyi seçebilir, süre ekleyebilir, azaltabilir, yeniden başlatabilir ya da atlayabilir.

Varsayılan süre önceliği aktif egzersiz ayarı, program egzersizi ayarı, kullanıcı genel ayarı ve 90 saniyelik uygulama varsayılanıdır. Supersette tam dinlenme yalnız turun son hareketinden sonra başlar.

Android bildirim izni reddedilirse zamanlayıcı çalışmaya devam eder. İzin verilirse `workout-rest-timer` kanalında yalnız “Dinlenme tamamlandı” ve “Sıradaki sete hazırsın” metinleri kullanılır; hareket, hesap veya sağlık verisi kilit ekranına yazılmaz. Haptik geri bildirim ayarlardan kapatılabilir. Ekranı açık tutma seçeneği yalnız aktif antrenman ekranı açıkken etkindir ve pil tüketimini artırabilir.

## Hızlı set girişi

Hazır bir set tek düğmeyle ve tek transaction içinde tamamlanır. Tekrarlanan hızlı dokunuşlar hem ekrandaki kilit hem de `is_completed = 0` koşullu veritabanı yazımıyla engellenir. Son set veya önceki antrenmandaki karşılık gelen set kopyalanabilir. `−5`, `−2,5`, `+2,5` ve `+5` kontrolleri seçili kg/lb birimine göre çalışır; saklama birimi kg olarak kalır. Virgül ve nokta girişi kabul edilir, negatif ağırlık üretilmez ve vücut ağırlığı hareketlerinde sıfır ek yük geçerlidir.

Tamamlanmamış set eklenebilir veya kaldırılabilir. Son tamamlanan set, aktif antrenman bitmeden geri alınabilir; toplamlar ve türetilen rekorlar kalıcı satırlardan yeniden hesaplandığı için ayrı ve artık bir rekor kaydı kalmaz.

## Set türleri ve efor

Kalıcı set türleri `Isınma`, `Çalışma`, `Drop set`, `AMRAP` ve `Tükeniş`tir. Eski satırlar `Çalışma` olarak yükseltilir. Tamamlanmış ısınma setleri ayrı sayılır; birincil çalışma seti, tekrar, hacim ve kişisel rekor hesaplarına katılmaz. Diğer dört tür tamamlandığında bu toplamlara katılır. Aynı politika canlı özet, tamamlanan özet, geçmiş, rekor ve profil analitiği sorgularında kullanılır.

Efor takibi isteğe bağlıdır: `RPE`, `RIR` veya `Kapalı`. RPE 1–10 arasında 0,5 adımlı, RIR 0–10 arasında tam sayıdır. TitanLog bu iki ölçeği birbirine dönüştürmez ve ağırlık ya da tekrardan efor tahmin etmez. Farklı efor modları aynı oturumda karışırsa yanıltıcı bir ortalama gösterilmez.

## Supersetler ve aktif esneklik

Programda veya yalnız aktif antrenmanda en az iki hareketten superset oluşturulabilir. Bir hareket gruptan çıkarılabilir veya grup tamamen çözülebilir; geriye tek üyeli bir grup bırakılmaz. Grup kimliği ve sıra workout snapshot’ına yazılır. Tur içindeki ara hareket tamamlandığında sıradaki hareket seçilir, turun son hareketinden sonra dinlenme başlar.

Aktif antrenmanda kaynak programı değiştirmeden hareket ekleme, başlamamış hareketi kaldırma veya değiştirme, sıralama, atlama/devam etme, set yönetimi, dinlenme süresi ve superset düzenleme yapılabilir. Çok satırlı işlemler exclusive transaction kullanır.

## Önceki performans ve özetler

Önceki performans, aynı kanonik egzersiz kimliğinin en yakın tamamlanmış oturumundan odaklı SQLite sorgularıyla getirilir. İptal edilen oturumlar, tamamlanmamış setler ve birincil karşılaştırmada ısınma setleri dışarıda kalır. Başlıklar ve setler toplu yüklenir; egzersiz başına sorgu yapılmaz.

Canlı özet süreyi, tamamlanan egzersiz ve çalışma setlerini, tekrarları, geçerli hacmi, rekorları, kalan hareketleri ve zamanlayıcı durumunu gösterir. Tamamlanan özet ısınmayı ayrı gösterir; önceki aynı program günü yoksa karşılaştırma üretmez, önceki hacim sıfırsa yüzde iddiasında bulunmaz.

## Kurtarma, misafir kullanımı ve veri güvenliği

Aktif oturum; setler, set türleri, efor, superset, atlama durumu, not ve mutlak zamanlayıcı tarihiyle SQLite içinde kalır. Navigasyon, arka plan, force-stop veya süreç sonlanması oturumu silmez. Açılışta devam kartı gösterilir; silme yalnız açık onayla yapılır ve iptal edilen oturum tamamlanmış geçmişe girmez.

Misafir kullanım tam işlevlidir. Hesaba giriş yerel veri kümesinin sahipliğini otomatik üstlenmez. Yerel yedek, özel bulut yedeği ve manuel cihaz eşitleme aynı kanonik fitness arşivi doğrulamasını kullanır. Arşiv şema 5; set türü, efor, timer, superset ve not alanlarını taşır. Şema-4 arşivleri güvenli varsayılanlarla yükseltilir. Cihaza özel bildirim kimliği arşivden çıkarılır; eşitleme bookkeeping, oturum token’ları ve profil medyası fitness arşivine girmez.

## Watch-ready sınırı

Telefon tarafında veritabanı ayrıntılarını dışarı açmayan küçük, tipli workout komut ve olay sözleşmeleri tanımlıdır. Gelecekteki bir eşlikçi uygulama aynı repository/domain işlemlerini kullanmalıdır; ikinci bir antrenman motoru oluşturulmamalıdır.

Bu sürüm Galaxy Watch, Wear OS, Bluetooth, Health Connect veya Samsung Health entegrasyonu içermez. Arka plan bulut eşitlemesi, otomatik yedekleme ve sağlık platformuna veri aktarımı yapılmaz.

## Bilinen sınırlar

- Yeni bildirim, haptik ve keep-awake native paketleri nedeniyle taze development build gerekir.
- Bildirim görünümü Android’in izin ve kilit ekranı ayarlarına bağlıdır; izin verilmemesi zamanlayıcıyı bozmaz.
- Fiziksel Samsung Galaxy A55 kabul testi henüz yapılmamıştır.
- Arşiv şema 5’i kabul eden Supabase migration’ı yerel olarak hazırlanmıştır ancak deploy edilmemiştir; gerçek bulut yedeği/eşitleme kabulü yayın öncesinde ayrıca yapılmalıdır.
- Galaxy Watch ve Health Connect sonraki sürümlerin kapsamıdır.
