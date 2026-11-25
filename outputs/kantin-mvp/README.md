# Kantin Kita - MVP Antrean dan Estimasi Waktu

Aplikasi web lokal untuk membuat pesanan, memantau antrean, dan memperkirakan waktu siap dengan Random Forest Regression. **Model yang disertakan dilatih dengan data simulasi. Hasilnya hanya untuk demonstrasi dan belum menggambarkan akurasi kantin sebenarnya.**

## Teknologi yang digunakan

- **React 18 dan Vite:** membuat tampilan halaman pembeli, status, petugas, dan papan. Kode React ada di folder `frontend`.
- **CSS:** mengatur tampilan halaman (`frontend/src/styles.css`).
- **Python dan Flask:** menjalankan server, menyajikan tampilan React, dan mengatur alur pesanan serta antrean.
- **SQLite:** menyimpan data dalam satu file, sehingga tidak perlu memasang server database terpisah.
- **scikit-learn:** menyediakan Random Forest Regression. **joblib** menyimpan dan memuat model.

Pilihan ini dibuat agar prototipe mudah dijalankan dan dipelajari. SQLite dan Flask cocok untuk demonstrasi sederhana; kebutuhan penggunaan banyak pengguna perlu dikaji lagi. Paket machine learning tetap memerlukan pemasangan dependensi Python.

## Panduan membaca struktur kode

```text
kantin-mvp/
├── app.py                # Server Flask: alur API dan penyajian tampilan React
├── backend/
│   ├── database.py       # Koneksi, tabel, dan menu awal SQLite
│   ├── helpers.py        # Fungsi bantuan untuk API dan akses petugas
│   └── menu_awal.py      # Daftar menu awal dan harga dalam rupiah
├── predictor.py          # Menyiapkan fitur dan memakai model
├── train_demo.py         # Melatih model dengan data simulasi
├── model.joblib          # Model demonstrasi yang sudah dilatih
├── requirements.txt      # Daftar dependensi Python
├── jalankan.bat          # Menyiapkan dan menjalankan di Windows
└── frontend/             # Tampilan React (Vite)
    ├── index.html        # Titik masuk halaman
    ├── vite.config.js    # Pengaturan Vite dan penerusan /api saat pengembangan
    ├── package.json      # Daftar paket npm dan perintah build
    ├── public/           # Berkas statis (ikon)
    ├── dist/             # Hasil build yang dibaca Flask (dibuat oleh npm run build)
    └── src/
        ├── main.jsx      # Memasang aplikasi React ke halaman
        ├── App.jsx       # Memilih halaman berdasarkan alamat
        ├── api.js        # Fungsi untuk memanggil API Flask
        ├── format.js     # Format rupiah, status, dan jam
        ├── styles.css    # Tampilan halaman
        ├── components/
        │   └── Layout.jsx    # Header, footer, dan kerangka halaman
        └── pages/
            ├── OrderPage.jsx    # Halaman pembeli (/)
            ├── StatusPage.jsx   # Status pesanan (/pesanan/<token>)
            ├── StaffPage.jsx    # Panel petugas (/petugas)
            └── BoardPage.jsx    # Papan publik (/papan)
```

Untuk mempelajari alur, mulai dari `frontend/src/App.jsx` lalu buka halaman yang dipilih, misalnya `frontend/src/pages/OrderPage.jsx`. Endpoint pemesanan ada di `app.py`. Prediksi dipanggil dari `predictor.py`; cara pelatihan model demo ada di `train_demo.py`.

Untuk mengubah tampilan dan melihat hasilnya langsung:

1. Jalankan `app.py` seperti biasa (atau `jalankan.bat`).
2. Di folder `frontend`, jalankan `npm install` (sekali saja), lalu `npm run dev`.
3. Buka `http://localhost:5173`. Permintaan `/api` diteruskan ke Flask di port 5000.

Setelah mengubah kode React, jalankan `npm run build` agar Flask di port 5000 menampilkan perubahan itu.

## Menjalankan di Windows

1. Instal Python 3.11-3.13 dan pastikan perintah `python` tersedia di terminal.
2. Klik dua kali `jalankan.bat`. Saat pertama kali, skrip membuat virtual environment dan mengunduh paket melalui internet.
3. Buka `http://127.0.0.1:5000` di browser. Biarkan jendela terminal tetap terbuka selama aplikasi dipakai. Tekan Ctrl+C untuk menghentikannya.
4. Halaman petugas ada di `http://127.0.0.1:5000/petugas` dan papan publik pesanan siap ada di `http://127.0.0.1:5000/papan`.

Akun untuk demonstrasi lokal: **admin** / **kantin123**. Ganti dengan variabel lingkungan `STAFF_USERNAME`, `STAFF_PASSWORD`, dan `SECRET_KEY` sebelum digunakan di lingkungan lain. Server ini dibatasi ke komputer lokal; aplikasi ini belum dirancang untuk penggunaan produksi atau paparan internet.

Jika tidak memakai skrip, pada terminal dalam folder ini jalankan:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Tampilan React sudah dibangun dan disertakan di `frontend/dist`. Jika folder itu tidak ada, `jalankan.bat` akan membangunnya dengan `npm`, yang memerlukan Node.js LTS.

Apabila model rusak atau tidak tersedia, pesanan tetap dicatat dan estimasi bertuliskan belum tersedia. Untuk membuat ulang model simulasi: `.\.venv\Scripts\python.exe train_demo.py`.

## Cara mencoba

1. Pilih satu atau lebih menu di halaman pembeli dan tekan **Buat pesanan**.
2. Simpan tautan halaman status; tautan ini mengandung token acak untuk melihat pesanan. Halaman status diperbarui setiap 10 detik.
3. Masuk ke halaman petugas; lihat urutan antrean dan ubah status **menunggu → diproses → siap → selesai**. Petugas dapat membatalkan pesanan yang belum siap serta mengelola menu.
4. Buka papan publik. Ketika petugas menandai pesanan **siap**, nomornya muncul di papan; setelah diserahkan dan ditandai **selesai**, nomornya tidak lagi ditampilkan. Papan diperbarui otomatis setiap 10 detik dan hanya menampilkan nomor serta waktu siap.
5. Cocokkan nomor pesanan sebelum menyerahkan makanan. Pesanan yang siap dapat berbeda urutan jika dikerjakan paralel.

## Data dan model

- Database SQLite dibuat otomatis di `instance/kantin.sqlite3`, beserta menu awal dari papan kantin. Nomor antrean terus bertambah. Harga dan ketersediaan dapat diubah dari panel petugas.
- Setiap pesanan menyimpan waktu penerimaan, rincian item dan potret jumlah antrean pada saat diterima. Waktu siap dicatat ketika petugas memilih status siap.
- Target yang dirancang adalah waktu dari diterima sampai siap dalam menit. Fitur demo: menu dan jumlah, jam/hari, serta pesanan aktif di depan. Sebagian besar nama menu kantin baru belum dikenali khusus oleh model simulasi dan diperlakukan sebagai `menu_lain`; prediksi untuk tiap menu belum divalidasi dengan data kantin nyata.
- `train_demo.py` menghasilkan data sintetis dan model contoh. Estimasi demo bukan hasil pengukuran riil. Untuk model yang dapat digunakan dalam studi kantin, kumpulkan data nyata, bagi data secara kronologis, latih dan evaluasi MAE terhadap baseline sebelum penerapan.
- Model dimuat dari `model.joblib`. Muat file model hanya dari sumber tepercaya. Versi dependensi dipatok di `requirements.txt` agar cocok dengan model yang disediakan.
- Waktu sistem disimpan dalam UTC+08:00 (WITA). Bila kantin berada di zona lain, atur zona waktu sebelum digunakan.

## Batasan

Tidak ada pembayaran online atau notifikasi. Estimasi adalah prediksi awal, tidak diperbarui otomatis. Status pembeli diperbarui otomatis, sedangkan panel petugas diperbarui saat tombol refresh ditekan. Antrean adalah prioritas kerja; sistem tidak memaksa seluruh pesanan selesai secara FIFO. Login demonstrasi dan server bawaan Flask tidak ditujukan untuk produksi.
