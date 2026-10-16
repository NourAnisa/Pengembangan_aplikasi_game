# Catatan pengujian Penjaga Sungai

Pemeriksaan dijalankan pada16Oktober2026 dengan Chromiumheadless dan Playwright pada lingkungan pengembangan. Bukti ini tidak menyatakan bahwa GitHubPages sudah live.

## Uji browser

11dari11 pemeriksaan lulus:

- PASS: Landing, local assets, PPT and design-document links
- PASS: Start briefing and dialogue stop the countdown
- PASS: Actual WASD / arrow movement and river-bank collision
- PASS: Pause / resume, help modal and sound UI
- PASS: Guardian hint and key property changes inventory and objective
- PASS: Optional parcel demonstrates capacity and safe storage
- PASS: Boat crossing, locked gate, three crates and winning ending
- PASS: Timeout ending and real retry button reset the mission
- PASS: Phone landing and dialogs fit 390px viewport
- PASS: Real touch direction movement and reachable action controls
- PASS: Production URL omits debugging hooks; browser has no missing assets or runtime errors

## Uji tambahan

- PASS: jalur normal tanpa teleport, dari posisi awal sampai menang, termasuk memilih paket lalu menitipkannya sebelum menyeberang.
- PASS: halaman game dan rancangan pada desktop1440×1000, HP390×844, serta mendatar844×390; tidak ada overflow horizontal; tombol arah minimal44px.
- PASS: JavaScript valid dan workflowGitHubActions dapat diparse.

Uji browser menggunakan debughook khusus `?test=1` untuk menyiapkan posisi dan waktu secara deterministik; interaksi tetap dijalankan melalui tombol dan event sebenarnya. Uji model tambahan memakai gerak normal di poligon tanpa mengubah posisi atau progres secara paksa.

Cuplikan di `screenshots/gameplay.png` berasal dari aplikasi yang berjalan saat uji browser, bukan gambar rancangan.