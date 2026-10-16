# Penjaga Sungai — Rancangan Game

Contoh fiktif untuk pembelajaran STI7356, pertemuan 6–8. Dokumen ini dapat diedit dan dikembangkan. Isinya bukan bukti proyek mahasiswa dan tidak menetapkan cakupan resmi UTS. Cakupan pengumpulan mengikuti arahan dosen.

## 1. Brief

- **Genre:** petualangan–puzzle 2D, satu pemain.
- **Platform:** browser desktop dan perangkat sentuh, ditayangkan melalui GitHub Pages.
- **Premis:** penjaga muda harus membuka pintu air sebelum banjir mengancam kampung.
- **Tujuan:** dapatkan kunci, menyeberang, bersihkan jalur, lalu buka pintu air sebelum 240 detik habis.
- **Tokoh:** penjaga muda bersyal merah (pemain) dan penjaga tua (pemberi petunjuk).
- **Lingkup:** satu level, empat properti utama, satu barang opsional, hasil menang atau waktu habis.

## 2. Pemetaan pembelajaran

| Pertemuan | Konsep yang diamati | Bukti yang dapat disiapkan sendiri | Template OBE |
| --- | --- | --- | --- |
| 6 | Properti, elemen formal dan dramatis, environment | Studi properti, ikon, fungsi, state, gambar environment | 2.4 dan 3.4 |
| 7 | Storyline dan storyboard | Narasi serta minimal enam panel, aksi/respons/transisi | 2.5 dan 3.5 |
| 8 | Review rancangan dan persiapan UTS | Pemeriksaan konsistensi desain dan inventaris bukti | Sesuai arahan dosen |

RPS menempatkan UTS pada pertemuan 8. Template mencakup keseluruhan semester; dokumen ini tidak menganggap seluruh implementasi akhir wajib selesai pada UTS.

## 3. Elemen formal dan dramatis

### Formal

- **Pemain:** satu orang mengendalikan penjaga muda.
- **Tujuan:** membuka pintu air.
- **Prosedur:** cari petunjuk → ambil kunci → naik perahu → bersihkan peti → gunakan kunci.
- **Aturan:** pintu hanya dapat dibuka setelah jalur bersih dan kunci dibawa.
- **Sumber daya:** 240 detik; kapasitas barang pada perahu 2 unit.
- **Konflik:** sungai memisahkan pemain dari tujuan, peti menutup jalur, dan waktu terus berjalan.
- **Hasil:** pintu terbuka berarti menang; waktu habis berarti gagal dan dapat mencoba lagi.

### Dramatis

- **Premis:** air sungai naik dan mengancam kampung.
- **Motivasi:** meneruskan tanggung jawab menjaga sungai.
- **Tokoh pendukung:** penjaga tua memberikan pengetahuan yang dibutuhkan pemain.
- **Dunia:** kampung tepi sungai, dermaga kayu, gudang, perahu warisan, dan pintu air.
- **Busur cerita:** ancaman → petunjuk → pencarian dan pilihan → hambatan → pemulihan aliran.
- **Properti bermakna:** tambalan perahu menyiratkan riwayat pemakaian. Narasi perahu warisan menghubungkan perjalanan pemain dengan keluarga.

## 3.4 Perancangan properti dan environment

| ID | Nama | Jenis | Fungsi | Aturan / state | Makna dramatis |
| --- | --- | --- | --- | --- | --- |
| PROP-01 | Kunci pintu air | Quest item | Membuka pintu air | Bobot 1; di gudang → di inventaris → digunakan | Kepercayaan menjaga kampung |
| PROP-02 | Perahu warisan | Alat / transportasi | Menyeberangi kanal | Kapasitas barang 2; menunggu → cek muatan → berlayar / menolak muatan berlebih → tiba | Warisan keluarga penjaga muda |
| PROP-03 | Peti penghalang | Obstacle | Menutup jalur ke pintu air | Menghalangi → berinteraksi / bersihkan → jalur terbuka | Barang yang hanyut akibat arus |
| PROP-04 | Pintu air | Objek tujuan | Mengatur aliran; sasaran akhir misi | Terkunci → kunci dibawa dan jalur bersih → terbuka | Keselamatan kampung |
| OPS-01 | Paket warga | Barang opsional | Memperagakan pilihan muatan | Bobot 2; paket + kunci = 3, melebihi kapasitas 2; dapat disimpan kembali | Mengajak pemain menentukan prioritas |

Paket bukan syarat kemenangan. Kapasitas 2 berlaku pada barang; bukan hitungan jumlah penumpang.

### Environment

- **Tepi barat:** titik awal, penjaga tua, gudang kunci, dan dermaga.
- **Kanal:** pemisah ruang yang membuat perahu relevan sebagai mekanisme.
- **Tepi timur:** tempat peti menghalangi jalur dan pintu air menjadi sasaran akhir.
- **Arahan visual:** jalur hangat, air toska, tanaman lembut, dan objek penting dengan kontras jelas.
- **Dokumentasi laporan:** sertakan gambar properti dan background yang benar-benar dibuat, nomor gambar, caption, serta alasan keputusan desain. Diagram konseptual tidak menggantikan bukti implementasi.

## 3.5 Perancangan storyline dan storyboard

### 3.5.1 Storyline

Hujan semalam membuat air sungai terus naik. Di sebuah kampung tepian sungai, seorang penjaga muda bersyal merah tiba di dermaga dengan perahu kayu warisan keluarganya. Pintu air di seberang masih terkunci, sementara waktu untuk memulihkan aliran semakin sedikit.

Penjaga tua menunjukkan bahwa kunci disimpan di gudang tepi barat. Sang penjaga muda mengambilnya, lalu kembali ke perahu. Sebuah paket warga dapat ikut dibawa, tetapi perahu hanya mampu menampung 2 unit barang. Jika paket dan kunci dibawa bersama, ia harus menyimpan kembali paket agar perjalanan bisa dilanjutkan.

Setelah menyeberang, ia menemukan peti hanyut menutup jalur menuju pintu air. Ia membersihkan peti, mendekati pintu, dan menggunakan kunci. Pintu terbuka, aliran kembali lancar, dan tugas menjaga kampung diteruskan. Jika 240 detik berlalu sebelum pintu terbuka, misi belum berhasil; pemain dapat memulai kembali dengan kondisi awal.

### 3.5.2 Storyboard

Thumbnail konseptual enam panel tersedia di [halaman rancangan](../docs.html#storyboard). Thumbnail merupakan skema, bukan tangkapan layar atau bukti hasil uji.

| Scene | Visual | Dialog / narasi | Aksi pemain | Respons sistem | Kondisi transisi |
| --- | --- | --- | --- | --- | --- |
| 01 — Panggilan dari sungai | Penjaga muda di dermaga; air naik | “Air terus naik. Pintu air harus dibuka.” | Memulai misi dan membaca pengantar | Menampilkan tujuan dan timer 240 detik | Misi dimulai → jelajahi dermaga |
| 02 — Petunjuk penjaga tua | Kedua tokoh berhadapan | “Kuncinya di gudang. Perahu kita hanya muat dua unit.” | Berinteraksi dengan penjaga tua | Memberikan petunjuk gudang, kapasitas, dan tujuan | Petunjuk diterima → cari kunci |
| 03 — Kunci berpindah tangan | Kunci di gudang dan konfirmasi inventaris | “Kunci pintu air ditemukan.” | Berinteraksi dengan kunci | Kunci berpindah ke inventaris | Kunci diperoleh → kembali ke perahu |
| 04 — Pilihan di dermaga | Pemain di perahu; indikator muatan | “Dahulukan pintu air. Paket dapat disimpan di dermaga.” | Memeriksa muatan, menyimpan paket bila perlu, menaiki perahu | Muatan ≤ 2: berlayar; muatan > 2: beri alasan dan tetap di dermaga | Tiba di timur → dekati peti |
| 05 — Buka jalan | Peti menutup jalur timur | “Peti hanyut menghalangi jalan.” | Berinteraksi untuk membersihkan peti | Hambatan hilang dan jalur terbuka | Jalur bersih → gunakan kunci di pintu |
| 06 — Sungai kembali bernapas | Pintu air terbuka, aliran pulih | “Pintu air terbuka. Kampung kita aman.” | Berinteraksi dengan pintu air sambil membawa kunci | Jika prasyarat lengkap: pintu terbuka, timer berhenti, kemenangan tampil | Misi selesai → main lagi / menu |

### Cabang gagal dan transisi tambahan

- **Kelebihan muatan:** jika paket dan kunci dibawa bersama, muatan = 3. Perahu tidak berangkat; pemain dapat menyimpan kembali paket. Selama waktu masih ada, misi tetap berjalan.
- **Prasyarat pintu belum lengkap:** tampilkan petunjuk yang relevan; pemain dapat melanjutkan.
- **Waktu habis:** dari scene gameplay mana pun, timer 00:00 sebelum pintu terbuka mengakhiri misi.
- **Coba lagi:** timer kembali ke 240; inventaris awal; kunci kembali di gudang; peti menghalangi; pintu terkunci.

## 4. Checklist review

- [ ] Fungsi, jenis, ikon, dan state setiap properti sesuai dengan perilaku dalam game.
- [ ] Kapasitas barang, bobot kunci, dan bobot paket dijelaskan tanpa ambigu.
- [ ] Narasi mempunyai hubungan sebab-akibat dan sesuai dengan urutan interaksi.
- [ ] Minimal enam panel memuat nomor, visual, dialog/narasi, dan aksi.
- [ ] Respons sistem dan kondisi transisi, termasuk cabang gagal, terdokumentasi.
- [ ] Gambar, tabel, dan bukti implementasi diberi nomor serta caption.
- [ ] Klaim progres dan pengujian didukung bukti yang benar-benar diperoleh.
- [ ] Batas pengumpulan UTS telah mengikuti arahan dosen.

Checklist ini adalah panduan review, bukan catatan bahwa pemeriksaan atau pengujian telah lulus.

## 5. Acuan dan batasan

1. RPS STI7356 — Pengembangan Aplikasi Game (2023), halaman tercetak 8–9; [PDF di repositori](../STI7356-Pengembangan_Aplikasi_Game.pdf).
2. Template Laporan STI7356 Pengembangan Game OBE yang diberikan: bagian 3.4 (properti dan environment), 3.5.1 (storyline naratif), dan 3.5.2 (minimal enam panel storyboard). Berkas template tetap merujuk pada dokumen yang diberikan dosen.
3. PPT Pertemuan 6–8 — Properti, Storyboard, dan Laporan OBE; [unduh](../Pertemuan_6_7_8_Properti_Storyboard_Laporan_OBE.pptx).

Penjaga Sungai adalah contoh fiktif pengembangan materi. Batas 240 detik dan rincian mekanisme muatan adalah keputusan prototipe ini, bukan ketentuan RPS. Rujukan teori akademik pada laporan mahasiswa harus ditelusuri ke sumber yang benar-benar dibaca; dokumen ini tidak menggantikannya.
