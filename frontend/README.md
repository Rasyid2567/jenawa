# JENAWA Frontend — Bootstrap Edition

Frontend JENAWA menggunakan React + Vite dan Bootstrap 5.3.8, dengan CSS khusus untuk menyesuaikan referensi UI/UX: warna mint, kartu rekomendasi pastel, layar aplikasi mobile terpusat pada desktop, dan navigasi bawah.

## Menjalankan aplikasi

1. Pastikan backend Express JENAWA berjalan di `http://localhost:3000`.
2. Salin `.env.example` menjadi `.env` jika alamat API berbeda.
3. Dari direktori proyek, jalankan:

```bash
npm install
npm run dev
```

4. Buka alamat Vite yang dicetak pada terminal, biasanya `http://localhost:5173`.

## Build produksi

```bash
npm run build
npm run preview
```

## Integrasi API

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET /api/emotions/categories`, `POST /api/emotions`, `GET /api/emotions`
- `POST /api/journals`, `GET /api/journals`
- `POST /api/sessions` untuk menyimpan sesi pernapasan setelah timer berakhir

Jurnal disimpan dan daftar jurnal dimuat kembali dari backend. Token sesi disimpan sementara di `sessionStorage`; untuk deployment produksi, pertimbangkan autentikasi cookie `HttpOnly`, `Secure`, dan `SameSite` yang didukung backend.

## Catatan pengujian

Kode sumber sudah disusun, tetapi harus diuji pada backend dan database Anda. Pastikan kategori emosi dan latihan sesuai dengan data yang aktif di PostgreSQL.


## Halaman Wawasan (menu Hari Ini)

- Menekan menu `Hari Ini` pada navigasi bawah membuka halaman `WAWASAN`.
- Halaman Wawasan mengambil riwayat check-in dari `GET /api/emotions?limit=100&offset=0` menggunakan token pengguna.
- Grafik menghitung jumlah check-in per hari selama tujuh hari terakhir dari data API. Ringkasan intensitas dan perasaan terbanyak dihitung dari catatan pada rentang tujuh hari tersebut; jika belum ada data, aplikasi menampilkan kondisi kosong dan tidak membuat statistik palsu.
- Tombol panah pada header Wawasan kembali ke beranda rekomendasi.
- Identitas merek pada header menggunakan logo JENAWA dan subjudul `Jenangan Wellness App`.


## Navigasi utama (5 tombol)
- Hari Ini membuka halaman Home.
- Eksplorasi membuka halaman Kenali Pola Perasaanmu yang memuat grafik tren check-in, ringkasan intensitas, kategori terbanyak, dan catatan terbaru.
- Tombol tengah membuka Check-in Perasaan. Ikonnya menggunakan logo JENAWA versi putih (reverse) di atas lingkaran hijau.
- Jurnal membuka halaman jurnal.
- Profil membuka pengaturan profil.

Pilihan mood pada halaman check-in memakai emoticon ekspresi wajah (contoh: 😌, 😣, 😟, 😩, 😄, 😢, 😠). Jika kategori dari API tidak cocok dengan pemetaan nama, fallback tetap emoticon wajah 🙂, bukan ikon objek/alam.
