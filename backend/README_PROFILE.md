# JENAWA — Backend Profil

Patch ini menambahkan profil pengguna berisi nama lengkap, NIS, kelas, jurusan, email akun, nomor HP opsional, dan foto profil.

## File yang ditambahkan/diubah
- `migrations/001_profile_fields.sql`: penambahan kolom profil dan indeks unik NIS opsional.
- `src/modules/profile/*`: route, validasi, query PostgreSQL, dan unggahan foto.
- `src/config/profileStorage.js`: lokasi penyimpanan foto di `uploads/profiles`.
- `src/app.js`: mount `/api/profile` dan file foto statis.
- `src/tests/profile.security.test.js`: test integrasi untuk profil dan kepemilikan.
- `package.json`: menambahkan Multer `^2.5.0` untuk upload multipart.

## Terapkan pada backend Anda
1. Cadangkan database dan folder backend terlebih dahulu.
2. Salin file dalam patch ke folder backend dengan struktur relatif yang sama.
3. Buka pgAdmin Query Tool pada database `jenawa_db`, lalu jalankan `migrations/001_profile_fields.sql`.
4. Di terminal folder backend, jalankan `npm install` agar Multer ditambahkan ke `package-lock.json`.
5. Jalankan `npm test -- src/tests/profile.security.test.js`.
6. Jika lulus, jalankan `npm run dev`.

## Endpoint
- `GET /api/profile`: mengambil profil akun yang sedang login.
- `PATCH /api/profile`: memperbarui `name`, `nis`, `class_name`, `major`, dan `phone`.
- `POST /api/profile/photo`: menerima multipart form dengan field file bernama `photo`.
- `DELETE /api/profile/photo`: menghapus foto profil akun sendiri.

Email dibaca dari `users.email` dan tidak dapat diubah lewat endpoint ini. Perubahan email sebaiknya menjadi alur terpisah dengan verifikasi.

Foto hanya menerima JPG, PNG, atau WebP maksimal 3 MB. File disimpan lokal di `uploads/profiles` dan kolom `profile_photo_url` menyimpan path relatif `/uploads/profiles/<nama-file>`. Foto dilayani sebagai berkas gambar statis; gunakan object storage persisten (misalnya Supabase Storage) sebelum deployment pada host dengan filesystem ephemeral. Tambahkan `uploads/profiles/` ke `.gitignore` agar foto pengguna tidak masuk Git.

Test membutuhkan database testing yang memiliki schema utama JENAWA serta akun database yang dapat membuat/menghapus data uji. Jangan menjalankannya pada database produksi.
