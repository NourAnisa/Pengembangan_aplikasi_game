# Catatan pengujian Penjaga Sungai 3D

Pemeriksaan dijalankan pada 16 Oktober 2026 dengan Playwright 1.62.1, pngjs 7.0.0, dan Chromium headless. WebGL memakai SwiftShader di lingkungan pengembangan. Hasil ini membuktikan render dan interaksi 3D berjalan, bukan benchmark GPU perangkat pengguna atau bukti bahwa GitHub Pages sudah live.

## Alur permainan

Seluruh 11 skenario lulus. Pemeriksaan dijalankan dalam kelompok delapan desktop, dua ponsel, dan satu URL produksi agar beberapa dunia WebGL tidak berebut sumber daya software renderer:

- Landing, aset lokal, tautan PPT dan dokumen rancangan tersedia.
- Briefing dan dialog menghentikan hitung mundur.
- WASD/tombol arah benar-benar menggerakkan tokoh; tepi sungai membatasi gerakan.
- Jeda, lanjut, bantuan, dan tombol suara berfungsi.
- Petunjuk Pak Jaga dan pengambilan kunci memperbarui inventaris serta tujuan.
- Paket opsional memperagakan kapasitas dan penitipan barang.
- Penyeberangan perahu, pintu terkunci, tiga peti, dan akhir menang berfungsi.
- Kehabisan waktu dan tombol ulang mengembalikan kondisi awal.
- Landing dan dialog muat pada viewport ponsel 390 px.
- Event sentuh nyata menggerakkan tokoh; tombol interaksi dapat dijangkau.
- URL normal tidak menyediakan debug hook; tidak ada error JavaScript atau aset lokal yang hilang.

Percobaan gabungan sempat berhenti saat menyiapkan konteks ponsel/produksi. Kelompok yang terpengaruh dijalankan ulang secara terpisah dan lulus. Tidak ada perubahan aturan permainan untuk meloloskan pemeriksaan tersebut.

## Render 3D

Delapan skenario WebGL lulus:

- Status pemuatan, tombol mulai, judul 3D, dan tautan pembelajaran.
- Konteks WebGL 2.0 nyata, geometri, tekstur, frame aktif, serta variasi piksel pada canvas.
- Raycast klik tanah menggerakkan tokoh; klik posisi kunci yang diproyeksikan menjalankan interaksi.
- Perahu menyeberang, peti bergeser, pintu air terbuka, dan adegan akhir dirender.
- Kualitas ringan dan perubahan ukuran desktop mempertahankan render 3D.
- Ponsel tegak dan mendatar mempertahankan dunia 3D serta kontrol di dalam viewport.
- Saat WebGL tidak tersedia, tautan versi 2D tampil dan permainan 2D tetap dapat dimulai.
- Tidak ada exception JavaScript atau sumber daya lokal yang hilang pada sesi 3D.

Sampel desktop kualitas tinggi mencatat 174 draw call, 192.792 segitiga, dan delapan tekstur. Bukti visual diperiksa dari canvas yang berjalan, termasuk variasi warna dan luminansi; pemeriksaan tidak hanya mengandalkan penghitung renderer. Mode otomatis memilih kualitas ringan pada SwiftShader.

## Pemeriksaan tambahan

- Jalur normal dari awal sampai menang lulus tanpa teleport, termasuk mengambil paket lalu menitipkannya sebelum menyeberang.
- Pemeriksaan ponsel tambahan menunggu ukuran drawing buffer berubah setelah rotasi layar; perubahan ke tampilan mendatar benar-benar dirender tanpa overflow.
- Simulasi hilangnya konteks WebGL saat bermain mengembalikan pemain ke halaman awal dengan tautan versi 2D.
- Sintaks JavaScript dan YAML workflow valid.
- Bundle persis seperti langkah publikasi Pages diperiksa: tautan HTML, impor modul lokal, lisensi Three.js, dan berkas runtime tersedia.

Uji browser memakai debug hook khusus `?test=1` untuk menyiapkan posisi dan waktu secara deterministik; tindakan tetap dijalankan melalui tombol dan event sebenarnya. Uji model tambahan memakai gerak normal dalam poligon tanpa mengubah posisi atau progres secara paksa.

Cuplikan di `screenshots/gameplay.png` dan sampul `../assets/cover3d.png` berasal dari versi 3D yang berjalan saat uji browser.
