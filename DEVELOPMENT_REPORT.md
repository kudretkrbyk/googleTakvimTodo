# Geliştirme raporu — 7 Ekim 2026

## Aşama 1: Repository ve veri katmanı

Tamamlandı:
- Expo SDK 57, React Native 0.86 ve strict TypeScript temel proje kuruldu.
- SQLite WAL, transaction migration altyapısı ve minimal task/event modeli oluşturuldu.
- Atomik görev + kalıcı kuyruk kaydı, offline işlem birleştirme ve revision koruması yazıldı.

Eklenen dosyalar:
- `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `app.config.ts`, `index.ts`
- `src/types/models.ts`, `src/storage/{database,migrations,taskRepository,store}.ts`

Değiştirilen dosyalar:
- Başlangıç repository’sinde uygulama dosyası bulunmuyordu.

Test:
- Gerçek SQLite ile oluşturma/düzenleme/silme, queue claim ve network sırasında revision koruma testleri.

Sıradaki:
- Google OAuth ve Calendar entegrasyonu (aşama 2’de yazıldı).

## Aşama 2: Google ve senkronizasyon

Tamamlandı:
- Native Google giriş, sessiz oturum ve SecureStore access token yönetimi.
- Calendar CRUD/PATCH, takvim listesi ve takvim taşıma.
- SyncToken pagination, 410 recovery, cancellation ve recurrence exception cache’i.
- Etag precondition, iki sürümü koruyan conflict handling ve atomik kullanıcı çözümü.
- Foreground/reconnect sync ve bekleyen yazmalar için sınırlı exponential retry.

Eklenen dosyalar:
- `src/services/{googleAuthService,googleCalendarService,mapping,taskService,conflictService}.ts`
- `src/sync/{syncEngine,syncQueue,conflictResolver}.ts`
- `src/hooks/useSync.ts`, `src/features/auth/useSession.ts`

Değiştirilen dosyalar:
- `src/storage/taskRepository.ts`, `src/storage/migrations.ts`, `package.json`

Test:
- Google transport test doubles ile gerçek SQLite cache üzerinde sync pagination, 410 recovery, cancellation, conflict, başarısız/retried create ve outbox testleri.
- Kullanıcı isteğiyle Google OAuth Client ID şimdilik ertelendi; gerçek hesapla doğrulama yapılmadı.

Sıradaki:
- Ekranlar ve recurrence (aşama 3’te yazıldı).

## Aşama 3: Ekranlar ve recurrence

Tamamlandı:
- Onboarding, 7/30 günlük grouped SectionList, native tarih/saat seçici, hızlı ekleme/düzenleme ve ayarlar.
- Google takvim seçimi, task checkbox, silme, recurrence günleri ve completion private metadata.
- Sistem/açık/koyu tema, erişilebilir kontroller, safe area ve Android geri tuşu.
- RRULE serilerini çoğaltmadan civil-time/DST koruyan görünür occurrence hesaplama.
- Tüm seri ve tek occurrence düzenleme; tek instance ilk erişimi ağ gerektirir.

Eklenen dosyalar:
- `App.tsx`, `src/screens/`, `src/components/`, `src/theme/theme.ts`
- `src/utils/{dates,recurrence}.ts`, `src/hooks/{useTheme,useEntryActions}.ts`

Değiştirilen dosyalar:
- `src/services/taskService.ts`, `src/storage/store.ts`, `package.json`

Test:
- Recurrence, DST, date grouping, all-day sıralama, Google mapping, completion testleri.
- Android Hermes JavaScript paketi üretildi.

Sıradaki:
- Native widget ve release (aşama 4’te yazıldı).

## Aşama 4: Widget, release ve dokümantasyon

Tamamlandı:
- 2×3 responsive RemoteViews AppWidget, widget başına 7/30 gün configuration activity.
- Kotlin native bridge, private bounded cache, task update/sync sonrası yenileme.
- Quick-add deep link, tarih/saat/timezone/reboot/launcher yenileme tetikleri.
- Prebuild sırasında Kotlin/XML/manifest/package kayıtlarını oluşturan tekrar çalıştırılabilir plugin.
- Environment signing destekli release Gradle plugin ve EAS APK/AAB profilleri.
- README: kurulum, Google Cloud, debug/release, widget ve fiziksel cihaz kabul testleri.

Eklenen dosyalar:
- `native/widget/`, `plugins/{withTaskWidget,withReleaseSigning}.js`
- `src/services/widgetService.ts`, `src/utils/widgetData.ts`
- `README.md`, `DEVELOPMENT_REPORT.md`, `scripts/android-env.sh`, `eas.json`, `eslint.config.mjs`, `tests/`, `.prettierignore`

Değiştirilen dosyalar:
- `App.tsx`, `app.config.ts`, `src/storage/store.ts`, `package.json`, `.gitignore`

Test:
- Widget projection minimal alanlar ve 100 kayıt limiti test edildi.
- Android SDK ve tam JDK sistemde eksikti; Git dışında `.local/` altına kuruldu.
- İlk debug APK derlemesi başarılı; release kontrolünde `/tmp` kotası doldu. Gradle cache `.local/gradle` altına taşındı.
- Native build sonucu aşağıdaki son doğrulama bölümünde belirtilir.

Sıradaki:
- Google Client ID/SHA-1 kurulumundan sonra gerçek hesap ve fiziksel cihaz kabul testleri.

## Son doğrulama

- `npm test`: **35 test geçti**.
- `npm run typecheck`: geçti.
- `npm run lint`: geçti.
- `npx expo prebuild --platform android --no-install`: geçti.
- `npx expo export --platform android`: Android Hermes paketi üretildi.
- Android ARM64 `assembleDebug assembleRelease bundleRelease`: başarılı.
- Debug APK, imzasız release APK ve AAB üretildi; son kaynakları içeren incremental paketleme de başarılı (1 dk 30 sn).
- Testler ayrıca `TZ=UTC` ve `TZ=America/New_York` altında 35/35 geçti.
- Yerel SDK/JDK ve Gradle cache’i otomatik kullanan build script’leri hazır.
- `.env`, keystore, `.local`, `android`, `node_modules` dosyalarının Git dışında olduğu doğrulandı.
- Google Web Client ID `.env` içinde yapılandırıldı; canlı OAuth/Calendar cihaz testi henüz yapılmadı.
- Fiziksel cihaz/launcher testi: yapılmadı.

## Bilinen sınırlar

- Tek occurrence’ın ilk düzenlemesi/tamamlanması Google instance ID için ağ ister.
- “Bu ve sonraki” seri bölme uygulanmadı.
- Uygulama kapalıyken Google sync çalışmaz; cache widget tarih değişiminde filtrelenir.
- Widget teması sistem temasını izler; uygulamanın bağımsız tema seçimini izlemiyor.
- iOS native login/build/widget kabul testi yapılmadı.
- `npm audit fix` sonrası Expo/Metro araç zincirinde advisory’ler kaldı; önerilen force downgrade uygulanmadı.

## Üretilen dosyalar

- `.local/artifacts/sade-debug-arm64.apk` — debug, Metro gerektirir.
- `.local/artifacts/sade-release-arm64-unsigned.apk` — release, imzasız.
- `.local/artifacts/sade-release-arm64-unsigned.aab` — release bundle, imzasız.
- Build logları: `.local/android-debug-build.log`, `.local/android-final-build.log`, `.local/android-verified-build.log`.

Google Client ID/SHA-1 ve fiziksel cihaz kabul testleri tamamlanana kadar uçtan uca MVP kabulü açık kalır.

## Google bağlantısı için kurulum APK’sı

- Kullanıcının `.env.example` içine girdiği Web Client ID `.env` içine taşındı; örnek dosya yeniden boş şablon haline getirildi.
- `.env` Git dışında tutuluyor.
- `scripts/build-test-apk.sh` ve `npm run build:test-apk` eklendi.
- Gradle’ın `.env` değişikliklerini atlamaması için test build’de üretilmiş JS bundle yeniden oluşturulur.
- APK release JS paketini içerir, Metro gerektirmez ve mevcut debug sertifikasıyla test amaçlı imzalanır.
- USB cihaz kontrolünde bağlı telefon bulunmadı; telefona manuel yükleme gerekir.

Test APK doğrulaması: build başarılı (1 dk 4 sn), Google Web Client ID APK içindeki JS bundle’da bulundu, APK v2/v3 imzası doğrulandı. Paket `com.sade.calendar`, ARM64, Android 7.0+; çıktı yaklaşık 28 MB.

Client ID değişikliği sonrası test APK yeniden üretildi (1 dk 3 sn). Güncel değer APK içindeki JS bundle’da doğrulandı. Yeni dosya: `.local/artifacts/sade-google-test-arm64-v2.apk`.

Web OAuth Client ID güncellendikten sonra APK yeniden üretildi (1 dk 3 sn). Güncel ID bundle içinde doğrulandı. Çıktı: `.local/artifacts/sade-google-test-arm64-v3.apk`.

## Google → uygulama senkronizasyon düzeltmesi

Tamamlandı:
- Foreground’a dönüşte 60 saniyelik throttle nedeniyle atlanan sync kaldırıldı.
- Devam eden sync sırasında gelen foreground/manüel/kullanıcı değişikliği tetikleri bir sonraki geçiş için korunuyor.
- Event düzeyindeki Google yazma/izin hataları ve erişilemeyen takvimler, sağlıklı takvimlerdeki incoming değişiklikleri durdurmuyor.
- Offline durumda sürekli retry timer ile ağ sorgulaması yapılmıyor.

Eklenen dosyalar:
- `src/sync/syncTriggers.ts`, `tests/syncScheduling.test.ts`

Değiştirilen dosyalar:
- `src/hooks/useSync.ts`, `src/sync/syncEngine.ts`, `tests/repository.test.ts`, `README.md`

Test:
- 42 test, TypeScript ve lint geçti.
- Google’dan yeni event, değişiklik, silme; 60 saniye içinde foreground dönüşü; busy sync sırasında follow-up; izin hatasına rağmen healthy calendar pull testleri eklendi.

Sıradaki:
- Telefonda Google Takvim → Sade dönüşü ve manuel yenileme kabul testi.
- Google Takvim içindeki “Görev” kayıtları için ayrı Google Tasks entegrasyonu eklendi (aşağıdaki bölüm).

Sync düzeltmesi APK’sı: `.local/artifacts/sade-google-test-arm64-v4-sync.apk`. Release build başarılı (1 dk 5 sn); güncel Client ID bundle içinde, APK test imzası doğrulandı.


## Google Tasks bağlantısı

- Calendar API’nin döndürmediği Google Tasks kayıtları, tüm görev listeleri üzerinden ayrı servisle okunur. Aynı yerel liste/widget akışına tarih bazında dahil edilir.
- Tasks izni kullanıcı “Google görevlerini bağla” düğmesine dokunduğunda artımlı olarak istenir. Calendar girişine yeni zorunlu izin eklenmez. İzin SecureStore’da saklanır ve çıkışta temizlenir.
- Sağlayıcı/undated bilgileri JSON kayıtlarda tutulur; mevcut SQLite önbelleğine uyumludur. Tasks ad alanı `gtasks:` Calendar ID çakışmasını önler.
- Tamamlama, başlık/tarih güncelleme ve silme mevcut çevrimdışı kuyruğu kullanır. PATCH yalnızca değişen desteklenmiş alanları gönderir; ETag çakışması iki sürümü korur.
- Tasks sayfalama, server güncelleme zamanı ve bir saniyelik örtüşmeyle `updatedMin` kullanır. Watermark ancak bütün sayfalar işlenince ilerler. Gizlenmiş tamamlamalar ve silinmiş kayıtlar indirilir.
- Google Tasks API etkinleştirilmesi ve yeni kapsam için kullanıcı hesabındaki Google Cloud ayarı gerekir. Canlı hesap testi kullanıcı telefonunda yapılacaktır.
- API saat/tekrar sağlamaz; tarihli görevler gün grubunda görünür. Tarihsiz görevler zaman ufkuna eklenmez. Yeni görev oluşturma önceki Calendar akışını korur.

Doğrulama: TypeScript, ESLint ve 57 test başarılı. İmzalı ARM64 APK derlemesi başarılı (1 dk 1 sn); imza ve bundle içindeki güncel Web Client ID / Tasks scope / Tasks endpoint doğrulandı. Artefakt: `.local/artifacts/sade-google-test-arm64-v5-tasks.apk`. Gerçek Google hesabı ve telefonda Tasks görünürlüğü henüz kullanıcı tarafından doğrulanmadı.
