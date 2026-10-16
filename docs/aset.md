# Catatan Aset Penjaga Sungai

Dokumen ini memisahkan ilustrasi rancangan dari bukti proyek dan mencatat asal aset yang dipakai. Halaman game tidak memuat dependensi font atau gambar dari layanan pihak ketiga.

## Ilustrasi halaman rancangan

| Lokasi | Aset | Asal / kegunaan |
| --- | --- | --- |
| `docs.html`, SVG inline | Peta konseptual level | Digambar khusus sebagai skema dunia, bukan screenshot gameplay |
| `docs.html`, SVG inline | Ikon kunci, perahu, peti, pintu air, dan paket | Dibuat khusus untuk menjelaskan identitas serta fungsi properti |
| `docs.html`, SVG inline | Dua karakter dan vegetasi | Digambar khusus untuk ilustrasi rancangan dan konsistensi storyboard |
| `docs.html`, SVG inline | Enam thumbnail storyboard | Komposisi ilustrasi konseptual; bukan bukti proses implementasi atau hasil uji |

SVG tersebut dibuat untuk proyek ini menggunakan bentuk vektor dan tidak menyalin aset game komersial.

## Aset visual game

Aset berikut dibuat khusus menggunakan image_gen bawaan pada16Oktober2026. Seluruh PNG disalin dari hasil generasi asli tanpa overlay teks. Transparansi karakter dan perahu diperiksa. Canvas memotong margin transparan pada saat rendering dan menggambar indikator interaksi, air, serta partikel secara terpisah.

| Berkas | Jenis | Asal / metode | Penggunaan |
| --- | --- | --- | --- |
| `assets/world.png` | Latar ilustrasi1672×941 | image_gen, hasil `exec-2e50820b-6ace-447d-bf97-526d07c8ec37.png` | Peta dua tepi sungai dan latar halaman |
| `assets/world_open.png` | Latar akhir kemenangan | image_gen edit dari world.png, hasil `exec-5d9f9d88-3dbf-4d78-a478-7e2d5e4436f5.png` | Pintu air terbuka setelah misi selesai |
| `assets/hero.png` | TokohRGBA1024×1536 | image_gen, hasil `exec-a7fe6583-415d-470d-b518-a5a04a42ae07.png` | Raka bersyal merah |
| `assets/guardian.png` | NPCRGBA1024×1536 | image_gen, hasil `exec-52e6d552-c0fd-4724-b779-57e649111ac3.png` | Pak Jaga |
| `assets/boat.png` | PerahuRGBA1774×887 | image_gen, hasil `exec-2cefa52a-f506-4c65-8d75-4cc79ec301d8.png` | Perahu warisan keluarga |
| `assets/favicon.svg` | Ikon navigasi | Bentuk vektor asli proyek | Ikon browser |
| Canvas | Kunci, peti, marker, efek air/partikel | Bentuk dan animasi yang digambar oleh kode game | Objek interaktif dan umpan balik |
| WebAudio | Nada interaksi dan hasil | Sintesis osilator dalam browser | Efek suara, tanpa rekaman pihak ketiga |

## Materi pembelajaran

- RPS yang ditautkan sudah ada di repositori. Template OBE hanya menjadi acuan struktur; berkas DOCX yang diberikan tidak disalin ke situs.
- PPT pertemuan 6–8 digunakan sebagai acuan konsistensi contoh Penjaga Sungai.
- Konten contoh tidak menjadi bukti bahwa mahasiswa telah membuat atau menguji proyek.
- Nama game, tokoh, dan dunia pada prototipe merupakan contoh fiktif untuk pembelajaran.
