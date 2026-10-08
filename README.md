# Sade — Google Takvim görev listesi

Android öncelikli React Native + TypeScript uygulaması. Expo Development Build kullanır; Expo Go desteklenmez. Backend, analytics ve sunucuya takvim verisi gönderimi yoktur.

## Kurulum

Node.js 24 LTS, tam **JDK 17** (`java` ve `javac`), Android SDK Platform 36, Build Tools 36/35, NDK 27.1.12297006 ve CMake 3.22.1 gerekir. SDK/NDK sürümlerini üretilen Gradle yapılandırması belirler.

```bash
npm ci
cp .env.example .env
# .env içine Web OAuth Client ID ekle.
npm run prebuild
npm run android
```

Android Studio SDK Manager ile araçları kurabilir veya [Android CLI](https://developer.android.com/tools/agents/android-cli) kullanabilirsiniz. `ANDROID_HOME` SDK klasörüne, `JAVA_HOME` tam JDK klasörüne işaret etmelidir. Alternatif olarak `android/local.properties` içine `sdk.dir=/tam/sdk/yolu` yazılabilir.

Bu çalışma sırasında kurulan, Git dışında tutulan araçları kullanmak için repository kökünde:

```bash
export JAVA_HOME="$PWD/.local/jdk17"
export ANDROID_HOME="$PWD/.local/android-sdk"
export GRADLE_USER_HOME="$PWD/.local/gradle"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Fiziksel telefonda geliştirici seçenekleri/USB hata ayıklamayı açın. `adb devices` ile bağlantıyı kontrol edin. Google Play Services bulunan bir cihaz veya Google Play sistem imajlı emülatör kullanın.

```bash
adb reverse tcp:8081 tcp:8081
npm start
```

## Google Cloud Console: manuel adımlar

1. Bir Google Cloud projesi seçin/oluşturun. Mevcut projeniz kullanılabilir.
2. **APIs & Services → Library → Google Calendar API** etkinleştirin.
3. Google Auth Platform içinde uygulama adını, destek e-postasını ve hedef kitleyi ayarlayın. Testing kullanılıyorsa kendi hesabınızı test kullanıcısı ekleyin.
4. Data Access içinde `https://www.googleapis.com/auth/calendar.events` ve `https://www.googleapis.com/auth/calendar.calendarlist.readonly` izinlerini ekleyin. Uygulama takvim listesini okuyup izinli takvimlerde etkinlik değiştirir.
5. **Android OAuth Client** oluşturun: paket `com.sade.calendar`, uygulamayı imzalayan anahtarın SHA-1 değeri. Debug anahtarını görmek için prebuild sonrası:

   ```bash
   keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

6. Aynı Google projesinde **Web application OAuth Client** oluşturun. Client ID değerini `.env` içindeki `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` alanına yazın. Bu native akış için web redirect URI gerekmez. **Client secret uygulamaya konmaz.**
7. Release anahtarınız farklıysa onun SHA-1 değeri için ayrıca Android OAuth Client oluşturun. Play App Signing kullanılırsa Play Console uygulama imzalama sertifikasının SHA-1 değeri de kaydedilmelidir.
8. Metro’yu yeniden başlatın; değişiklik release JS paketinde kullanılacaksa APK/AAB’yi yeniden üretin.

`DEVELOPER_ERROR` genellikle paket/SHA-1/Client ID eşleşmemesidir. Kimlikler aynı Google Cloud projesine ait olmalıdır. [Native Google giriş kurulumu](https://react-native-google-signin.github.io/docs/setting-up/android) esas alınmıştır.

Android oturumunu Google Play Services yeniler; backend gerektiren server authorization-code / refresh-token değişimi kullanılmaz. Access token ve hesap kimliği SecureStore’dadır. Token SQLite’a veya widget cache’ine yazılmaz. İzin iptal edilirse Ayarlar → Google hesabını yeniden bağla kullanılır.

## Kullanım

Google bağlantısından sonra varsayılan takvim seçilir. Ana ekran bugünden itibaren 7/30 günlük kronolojik listedir. Tarih varsayılan bugün, saat boşsa tüm gün; yeni saatli görevlerin süresi bir saattir. Düzenlenen kayıtlarda mevcut süre korunur. Uygulamadan oluşturulan görevlerin checkbox’ı bulunur; normal Google etkinliklerinde bulunmaz. Tamamlanan kayıt silinmez, ana listeden gizlenir.

Her gün, hafta içi, hafta sonu, aynı haftalık gün ve özel günler RRULE olarak saklanır. Seri master’ı bir kere saklanır; görünür tarihler bellek içinde hesaplanır. Tekrarlanan kayıtta “Sadece bu etkinlik” veya “Tüm seri” seçilir. Tek bir occurrence’ın ilk düzenlemesi/tamamlanması gerçek Calendar instance ID’sini almak için ağ gerektirir. Tüm seri düzenleme ve yeni tekrar serisi ekleme çevrimdışı kullanılabilir. “Bu ve sonraki” seri bölme bu sürümde uygulanmadı.

Takvim değişikliği Calendar `events.move` işlemiyle gönderilir. Google tarafından taşınmasına izin verilmeyen etkinlikler (ör. bazı özel event türleri/organizer izinleri) gönderilemez; lokal değişiklik tutulur. Salt okunur takvimleri listelemek mümkündür; bu takvimlerde düzenleme yetkisi yoktur.

## Mimari

```text
src/components/         Ortak kontroller, liste ve takvim seçimi
src/features/auth/      Oturum başlangıcı ve bağlantı akışı
src/screens/            Onboarding, ana liste, düzenleme ve ayarlar
src/services/           Google OAuth/API, task ve widget servisleri
src/storage/            SQLite, atomik migrations, repository ve Zustand
src/sync/               Kalıcı kuyruk, sync engine, conflict resolver
src/utils/              Tarih/zaman dilimi ve recurrence
src/theme/              Merkezi renkler, boşluklar ve tipografi
native/widget/          Kotlin AppWidget, repository, updater, actions, bridge
plugins/                Native widget ve release-signing Expo config plugin’leri
```

`android/` üretilir, Git’e eklenmez. Native kaynak **native/widget/** altındadır; prebuild bunları ve manifest/package kayıtlarını yeniden oluşturur. Native değişikliklerden sonra yeniden prebuild + Android build yapılır. iOS uygulaması için native Google OAuth ve iOS client konfigürasyonu ayrıca yapılmalı; iOS widget bu sürümün kapsamında değil.

SQLite → UI önce açılır; Google isteği arka planda yapılır. Yeni değişiklik ile kuyruk kaydı aynı SQLite transaction’ına girer. Offline oluşturma+düzenleme tek create içinde birleşir. Google’a hiç gönderilmemiş create+delete yerelden kaldırılır. Gönderilme ihtimali olan kayıtların silme işlemi korunur. Ağ isteği sırasında yapılan yeni düzenlemeler revision kontrolüyle kaybolmaz.

İlk sync bir kez sayfalanan master/exception koleksiyonunu okur. Sonraki sync’ler takvim başına `nextSyncToken` kullanır; token yalnızca son sayfa tamamlanınca ilerler. `singleEvents=false`, `showDeleted=true` kullanılır; syncToken ile uyumsuz `timeMin`, `timeMax`, `orderBy` kullanılmaz. Geçmiş sıradan etkinlikler cache’e alınmaz; seriler ve istisnalar tutulur. 410 durumunda yalnızca temiz remote kayıtlar yeniden oluşturulur; offline değişiklikler korunur. [Google incremental sync](https://developers.google.com/workspace/calendar/api/guides/sync) protokolü uygulanmıştır.

Google sürümü etag ve remote updated zamanı ile karşılaştırılır. Server baseline değiştiyse cihaz saatini kesin doğru kabul ederek bir tarafı silmek yerine **iki sürüm SQLite’da saklanır**. Ayarlar ekranında hangi değişikliğin tutulacağı seçilir. PATCH/DELETE `If-Match` kullanır; ilgisiz reminders/attachments alanları değiştirilmez. Normal event’lerin private metadata’sı korunur. Task completion `extendedProperties.private` içindeki `source=sade`, `type=task`, `app_completed` alanlarıyla taşınır.

Uygulama açılışı, foreground, bağlantının gelmesi, kullanıcı değişikliği ve manuel yenileme sync tetikler. Google Takvim’den uygulamaya dönüşte, son sync üzerinden bir dakika geçmemiş olsa bile değişiklikler kontrol edilir. Devam eden sync sırasında gelen yenileme isteği, bitişinde bir ek sync ile karşılanır. Bir takvimdeki izin hatası veya gönderilemeyen bir kayıt, diğer erişilebilir takvimlerin okunmasını engellemez. Başarısız bekleyen yazmalar artan aralıklarla, en fazla altı otomatik deneme ile tekrar gönderilir; manuel sync yeniden deneyebilir. Sürekli Google polling yapılmaz. Uygulama tamamen kapalıyken Google sync çalışmaz; tekrar foreground/reconnect ile devam eder.

RRULE hesaplaması seri timezone’unda duvar saatini korur; DST testi vardır. Çok sık SECONDLY/MINUTELY/HOURLY dış kaynak serilerinin genişletilmesi desteklenmez; master tutulur. Büyük listeler için görünür occurrence sayısı seri başına sınırlıdır. Imported RDATE/EXDATE kurallarının bütün ileri kombinasyonları cihazda henüz canlı doğrulanmadı.

## Android widget

Kotlin RemoteViews AppWidget; başlangıç 2×3 hücre, yatay/dikey resize. Launcher ölçüleriyle yakın kayıt sayısını sınırlar. Widget Google API’ye bağlanmaz; yalnızca private SharedPreferences’ta başlık+tarih+saat içeren, en fazla 100 kayıtlık projection okur. Bridge snapshot’ı boyut ve JSON kontrolü yapar. Sürekli polling yoktur (`updatePeriodMillis=0`). Task değişikliği/sync, launcher resize/update, tarih/saat/timezone/tema değişimi ve reboot yeniler. Widget sistem açık/koyu temasını izler.

Telefonda ana ekrana uzun basın → Widget’lar → Sade. Konfigürasyonda 7/30 gün seçin; farklı widget’ların ayarları ayrıdır. “＋ Hızlı görev ekle” `sade://quick-add` ile doğrudan editöre gider. Başlangıç tercihi Ayarlar’da seçilir; yapılandırılmış widget’ın kendi tercihi korunur.

Önbellek uygulama kapalıyken yalnızca tarih filtrelemesini yeniler; Google’daki yeni değişiklikleri almak ve 30 günlük snapshot ufkunu ilerletmek için uygulamanın açılması gerekir. Widget/iOS entegrasyonu için fiziksel cihaz testleri tamamlanmadan production hazır sayılmamalıdır.

## Kontroller

```bash
npm run typecheck
npm run lint
npm test
npx expo export --platform android
```

Testler recurrence/DST, tarih gruplama/sıralama, Google mapping/completion, conflict ve **gerçek SQLite** üzerinde kuyruk birleştirme, revision koruma, sync pagination, 410 recovery, cancellation ve ağ hatalarını kapsar. Google transport testte mock edilir; uygulamada demo veri, sahte OAuth veya mock API kullanılmaz.

## Debug ve release build

Bu makinede `npm run build:debug`, `npm run build:apk` ve `npm run build:aab` script’leri `.local` altındaki JDK/SDK/cache’i otomatik kullanır; farklı bir kurulum için `JAVA_HOME`, `ANDROID_HOME`, `GRADLE_USER_HOME` environment değerleri önceliklidir.

```bash
npm run prebuild
cd android
./gradlew assembleDebug
./gradlew assembleRelease
./gradlew bundleRelease
```

Çıktılar `android/app/build/outputs/apk/debug/`, `apk/release/` ve `bundle/release/` altındadır. APK telefona `adb install -r dosya.apk` ile yüklenir. Debug APK Metro gerektirir; release JS paketini içerir.

Release kendi anahtarınızla imzalanır. Anahtarı repository dışında oluşturun:

```bash
keytool -genkeypair -v -keystore /guvenli/klasor/sade-release.jks -alias sade -keyalg RSA -keysize 2048 -validity 10000
```

Gradle çalıştırmadan önce aşağıdaki environment değerlerini terminal/CI secret store üzerinden sağlayın:

```text
SADE_KEYSTORE_PATH=/tam/guvenli/yol/sade-release.jks
SADE_KEYSTORE_PASSWORD=...
SADE_KEY_ALIAS=sade
SADE_KEY_PASSWORD=...
```

Bu değerler `.env.example` içinde yer almaz ve native kaynaklara yazılmaz. Environment imzası bulunmazsa yerel release **unsigned** üretilir; unsigned APK doğrudan kurulamaz. Üretim anahtarı bulunmadan debug anahtarıyla otomatik release imzası yapılmaz. EAS yönetilen signing için plugin mevcut EAS ayarını korur.

İsteğe bağlı [EAS Build](https://docs.expo.dev/build/introduction/) yapılandırması `eas.json` içindedir: development build, internal preview APK ve production AAB. Kullanıcının Expo hesabı/proje/signing kurulumu gerekir. Bu çalışma Play Store’a yükleme/publishing yapmaz.

## Telefonda kabul testi

- Google bağlantısı, ilk takvim seçimi ve yeniden açılışta sessiz oturum.
- Tüm gün + saatli görev ekleme/düzenleme/silme ve Google web’de karşılığı.
- Google web’de başlık/saat değişikliği/silme → foreground/pull-to-refresh sonrası cihaz.
- Uçak modunda ekle/değiştir → yeniden açınca cache → bağlantı gelince Google.
- Her tekrar modu; tek occurrence değişikliği/tamamlama ve tüm seri silme.
- İki tarafta aynı kaydı offline değiştir → Ayarlar’da iki sürüm ve seçim.
- Çok takvim, takvim taşıma, izin iptali ve yeniden bağlama.
- Widget ekleme/resize/7–30 gün/hızlı ekleme/tarih değişimi/reboot/koyu tema.
- Büyük font, TalkBack, Android geri tuşu, klavye ve dar ekran.

## Doğrulama sınırı

Google Web Client ID `.env` içine eklendi. Gerçek hesapla OAuth ve Calendar uçtan uca doğrulaması henüz yapılmadı; bu adım tamamlanmadan çalışan MVP’nin bütün kabul maddeleri onaylanmış sayılmaz. Son yerel build/test sonuçları `DEVELOPMENT_REPORT.md` içinde kayıtlıdır.

`npm audit` Expo/Metro araç zinciri üzerinden advisory raporlamaya devam ediyor; uyumlu `npm audit fix` uygulandı. `--force` Expo’yu SDK 44’e düşürmeyi önerdiği için kullanılmadı. Güncel SDK uyumu bozulmadan upstream düzeltmeleri takip edilmelidir.

Son doğrulama için ARM64 hedefli debug APK, imzasız release APK ve imzasız release AAB üretildi. Kalıcı yerel kopyaları `.local/artifacts/` klasöründe bulunur (Git dışında). Google Client ID eklendiğinde release paketinin yeniden derlenmesi gerekir.

## Metro gerektirmeyen Google test APK’sı

```bash
npm run build:test-apk
```

Bu komut `.env` değişikliklerini JS paketine yeniden işler ve release APK’yi mevcut debug sertifikasıyla imzalar. Çıktı: `.local/artifacts/sade-google-test-arm64.apk`. Bu bir test imzasıdır; Play Store için production signing değildir.

Aynı Google Cloud projesinde Android OAuth istemcisinin paket adı `com.sade.calendar`, SHA-1 değeri `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` olmalıdır. Calendar API etkin olmalı; OAuth uygulaması Testing durumundaysa kullanılacak Google hesabı test kullanıcıları arasında olmalıdır.

APK’yi telefona aktararak açın ve yükleyin. Android dosya yöneticisi/tarayıcı için “Bu kaynaktan yüklemeye izin ver” isteyebilir. Google ile devam ettikten sonra bir görev ekleyip Google Takvim’de göründüğünü kontrol edin; ardından Google tarafında başlığı değiştirip uygulamada listeyi aşağı çekerek yenileyin. Widget’ı ana ekranın Widget’lar menüsünden ekleyebilirsiniz.

Google Takvim’de “Etkinlik” olarak oluşturulan kayıtlar Calendar API ile alınır. Google’ın “Görev” kayıtları ayrı Google Tasks servisindedir; bu sürüm, ek izin verildiğinde tüm görev listelerindeki tarihli kayıtları alır. Etkinliği telefondaki Takvim’den ekleyip Sade’ye döndüğünüzde sync tetiklenir; başka cihazdan ekliyorsanız Sade’de listeyi aşağı çekerek manuel yenileyebilirsiniz.


### Google Takvim içindeki Google görevlerini bağlama

1. Web OAuth Client ID’nin ait olduğu Google Cloud projesinde **APIs & Services → Library → Google Tasks API → Enable** seçin. Client ID değişikliği gerekmez.
2. **Google Auth Platform → Data Access** bölümünde `https://www.googleapis.com/auth/tasks` kapsamını ekleyin. Uygulama Testing durumundaysa bağlanacak hesap Audience altında test kullanıcılarında olmalıdır.
3. Yeni APK’yi mevcut uygulamanın üzerine kurun. Ana ekranda veya Ayarlar’da **Google görevlerini bağla** seçin ve aynı hesaba görev izni verin.
4. Google Takvim’de bugün/yaklaşan 7 veya 30 gün içine tarihli bir **Görev** ekleyin. Sade’ye döndüğünüzde veya listeyi aşağı çektiğinizde görev görünür. Uygulamadaki onay kutusu Tasks görevini tamamlar; mevcut görevin başlık/tarih düzenlemesi ve silinmesi de Tasks’e gönderilir.

Görev listeleri Calendar takvimi kimliklerinden ayrı adlandırılır; izin kalıcı güvenli depoda, kayıtlar mevcut SQLite önbelleğinde tutulur. Sayfalanmış Tasks sorguları server `updated` zamanına dayalı `updatedMin` kullanır; gizlenmiş tamamlamalar ve silinmiş kayıtlar dahil edilir. Bir Tasks erişim hatası Calendar kayıtlarının indirilmesini engellemez.

Google Tasks API yalnızca görev tarihini verir; saat ve tekrar ayarlarını okuyup yazamaz. Bu yüzden Tasks kayıtları tarih altında **Google görevi** etiketiyle gösterilir; saat/tekrar Google Takvim’den yönetilir. Tarihsiz görevler 7/30 günlük görünümde gösterilmez. Uygulamadaki “Yeni görev” mevcut Calendar etkinliği akışını kullanmaya devam eder. Google Tasks’te silinen bir görevi çakışma ekranından yeniden oluşturma desteklenmez; cihazdaki sürüm korunur ve Google Tasks’te yeniden ekleme istenir.

Kaynak: [Google Tasks görev kaynağı](https://developers.google.com/workspace/tasks/reference/rest/v1/tasks).
