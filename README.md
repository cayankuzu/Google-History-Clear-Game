# Son 40 Saniye

Trafik kazasından sonra telefonundaki 33 arama kaydını 40 saniye içinde
yönetmeye çalıştığın, topluluk havuzuyla büyüyen kısa bir kara mizah ve itibar
oyunu.

## Yerelde çalıştırma

```bash
npm install
npm run dev
```

- Oyun: http://127.0.0.1:3300
- Yerel içerik API’si: http://127.0.0.1:3301

Yönetici kullanıcı adı ve parolası `.env.example` üzerinden değiştirilebilir.
Canlı yayında güçlü ve benzersiz bir oturum sırrı kullanılmalıdır.

## Oynanış ve puan

- Her tur ortak havuzdan rastgele 33 arama geçmişi satırı üretilir.
- Havuz 33’ten küçükse aynı arama farklı zamanlara ait tekrar eden geçmiş
  girdileri olarak bir turda birden fazla kez görünebilir.
- Telefon listesini yukarı-aşağı kaydırabilir, bir kaydı sola sürükleyerek,
  yanındaki çarpıya basarak veya klavyede `Delete`, `Backspace` ya da `←`
  kullanarak silebilirsin.
- İyi aramaları korumak ve riskli aramaları silmek puan kazandırır. Masum
  aramaları silmek ve riskli aramaları bırakmak puan kaybettirir.
- Her turun risk dağılımı farklıdır; 0–1000 puan, turun teorik en iyi ve en kötü
  kararlarına göre normalize edilir.
- İtibar sıralaması 50 puanlık dar aralıklara bölünmüş 20 ayrı unvan kullanır.

## Ortak havuz, liderlik ve yönetim

Ana ekrandaki **Listeye arama ekle** alanı girilen aramayı yerel ortak havuza
ekler. Topluluk girdileri kategoriye ayrılmaz; tek havuzdan eşit olasılıkla
rastgele seçilir ve itibar puanında tarafsız kalır. Sonuç ekranında isteğe bağlı
kullanıcı adıyla skor liderlik tablosuna yazdırılabilir.

Yönetim panelinde:

- Arama düzenleme, gizleme, yayınlama ve silme
- Topluluk IP’sini görme, engelleme ve engeli kaldırma
- Liderlik skorlarını düzenleme ve silme
- İçerik veya skor sahibinin IP ve kalıcı tarayıcı cihaz kimliğini birlikte
  engelleme
- Kaydedilen tüm işlemlerin değişiklik özetini görme

araçları bulunur.

Cihaz kimliği IP değişse veya VPN kullanılsa bile aynı tarayıcı kurulumunu
tanımaya devam eder. Tarayıcı verilerinin silinmesi ya da farklı bir cihaz
kullanılması web tarafında kesin olarak önlenemez.

Yerelde veriler `server/data/community.json` dosyasında tutulur. Vercel
yayınında aynı API sözleşmesi Vercel Functions üzerinden çalışır; topluluk
aramaları, skorlar, engeller ve değişiklik kayıtları özel bir Vercel Blob
deposunda kalıcı olarak saklanır. Eşzamanlı düzenlemeler ETag tabanlı iyimser
kilitleme ve üç yönlü birleştirmeyle korunur.

## Doğrulama

```bash
npm run test:data
npm run lint
npm run build
```

Veri testi varsayılan havuzu, 33 kartlık turları, rastgele risk dağılımını,
tur tavanını, itibar puanını ve sonuç üretimini doğrular.
