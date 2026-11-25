# Catatan Pegangan Workflow Lengkap — Proyek ML Kantin U’Jasmine
**(Dari Masalah Lapangan & Pipeline Machine Learning hingga Arsitektur & Tampilan Website)**

Gunakan dokumen ini sebagai pegangan cepat bila dosen menanyakan alur kerja (*workflow*) proyek secara menyeluruh dari awal sampai tampilan website.

---

## Ringkasan 1 Menit (Alur Besar Hulu ke Hilir)

```text
[1. Observasi & Wawancara U'Jasmine]
        ↓
[2. Data Simulasi (1.526 Pesanan, 30 Menu) → Pipeline ML Anti-Leakage di Kaggle]
        ↓
[3. Evaluasi (RF vs LR vs Median) + Error Analysis Ekstrapolasi]
        ↓
[4. Backend Flask + SQLite (Potret snapshot_json + siap_at) + Model Demo RF]
        ↓
[5. Tampilan Web U'Jasmine (Pembeli → Status → Petugas → Papan Publik 3 Kolom)]
        ↓
[6. Siklus Data Nyata (Lembar Konfirmasi Petugas + Skrip Ekspor & Retraining)]
```

---

## 1. Workflow Tahap Awal: Masalah Lapangan & Wawancara

1. **Identifikasi masalah di Kantin U’Jasmine:**
   - Pembeli tidak tahu kapan pesanannya siap, sehingga menunggu di depan loket atau bolak-balik bertanya.
   - Belum ada papan status antrean publik.
   - **Kendala data (*cold-start*):** Kantin tidak memiliki CCTV dan belum ada riwayat pencatatan durasi pesanan digital.
2. **Validasi lapangan yang diperoleh:**
   - Izin implementasi dan daftar **30 menu asli beserta harga** dari papan kantin (`backend/menu_awal.py`).
   - **Wawancara kualitatif dengan petugas kantin ("Anti"):**
     - Faktor penentu utama cepat/lambatnya pesanan adalah **kesiapan bahan** (*"tergantung bahan, kalau sudah ready cepat"*).
     - Lama memasak antar-menu berbeda; menu berbahan **ikan** disebut memakan waktu paling lama.
     - **Jumlah petugas bekerja**, **jam ramai** (sekitar pukul 12.00), dan **ketersediaan bahan** dapat menyebabkan keterlambatan.
3. **Pertanyaan eksperimen yang ditetapkan:**
   - Bagaimana kinerja **Random Forest Regression** dibandingkan **Baseline Median** dan **Linear Regression** pada skenario antrean kantin simulasi?

---

## 2. Workflow Data & Pipeline Machine Learning (Notebook Kaggle)

Diimplementasikan di `outputs/Evaluasi_Random_Forest_Kantin_Kaggle.ipynb`:

1. **Pengumpulan Data Simulasi (`outputs/data_kantin_simulasi.csv`):**
   - 1.526 pesanan simulasi, 30 menu asli U’Jasmine, 1 jenis menu per baris dengan jumlah porsi bervariasi, berlabel `sumber_data=simulasi`.
   - Seluruh pola jam ramai, jumlah petugas, dan durasi berasal dari asumsi simulator (`work/simulate_canteen.py`), bukan pengamatan kantin.
2. **Validasi & Pembersihan Data:**
   - Memeriksa nilai kosong, format waktu, `jumlah > 0` bilangan bulat, `antrean_di_depan >= 0` bilangan bulat, dan durasi tidak negatif (`0` baris dibuang pada CSV simulasi).
3. **Pembentukan Target ($Y$) & Fitur ($X$) — Anti *Data Leakage*:**
   - **Target ($Y$):** `waktu_tunggu_menit = waktu_siap - waktu_pesan` (mencakup waktu mengantre + penyiapan, bukan waktu diambil pelanggan).
   - **Fitur ($X$):** hanya informasi yang **sudah diketahui saat pesanan masuk** — `menu`, `jumlah`, `antrean_di_depan`, `jam_pesan`, `hari_pesan`. `waktu_siap` **tidak pernah** masuk sebagai fitur `X`.
4. **Pembagian Data Kronologis (70% / 15% / 15%):**
   - Diurutkan berdasarkan `waktu_pesan` unik (bukan acak!) menjadi **1.068 Latih**, **229 Validasi**, dan **229 Uji** (semua 30 menu terwakili di ketiga partisi).
   - **Filter batas periode:** Baris latih/validasi yang `waktu_siap`-nya melewati batas waktu periode berikutnya disaring agar informasi masa depan tidak bocor ke pelatihan.
5. **Preprocessing & Pemilihan Parameter (Validasi):**
   - `OneHotEncoder(handle_unknown="ignore")` untuk 30 `menu` dibungkus dalam `ColumnTransformer` + `Pipeline`, sehingga penyandian dipelajari **hanya dari data latih**.
   - Membandingkan `min_samples_leaf` = `2` vs `5` pada data validasi → terpilih **`min_samples_leaf = 2`** (MAE validasi **1,76 menit** vs `2,06 menit`).
6. **Pelatihan Ulang & Evaluasi Akhir yang Adil:**
   - Melatih ulang ketiga metode pada gabungan **Latih + Validasi** (1.297 pesanan) lalu menguji semuanya pada **229 data uji yang sama**:
     - **Random Forest Regression** (`n_estimators=100`, `min_samples_leaf=2`, `bootstrap=True`, default scikit-learn `max_features=1.0` — seluruh fitur dipertimbangkan pada tiap percabangan).
     - **Linear Regression** (pembanding linear).
     - **Baseline Median** (`DummyRegressor`, pembanding dasar tanpa fitur).

---

## 3. Hasil Evaluasi & *Error Analysis* (Data Simulasi)

| Metode | MAE Uji (menit) | RMSE Uji (menit) | Keterangan |
|---|---:|---:|---|
| **Linear Regression** | **5,01** | **8,20** | Terbaik secara total pada pengujian simulasi ini |
| **Random Forest Regression** | **6,14** | **11,38** | Memangkas MAE **39,6%** dibanding Median |
| **Baseline Median** | **10,17** | **17,61** | Pembanding dasar tanpa fitur |

**Temuan Kunci *Error Analysis*:**
- **Dalam rentang antrean latih (`antrean <= 10`, 196 dari 229 pesanan uji):** Random Forest **lebih unggul** (**MAE 2,54 menit** vs Linear Regression **2,62 menit**).
- **Zona ekstrapolasi (`antrean 11–18`, 33 pesanan uji terakhir):** Data latih+validasi maksimum hanya memiliki 10 antrean (tunggu maks 29,08 menit), sedangkan data uji mengalami lonjakan hingga 18 antrean (tunggu maks 61,33 menit). Karena pohon keputusan tidak dapat mengekstrapolasi melampaui nilai target latih, prediksi Random Forest mentok di **≤ 24,52 menit** (MAE 27,56), sedangkan Linear Regression tetap naik linear (maks 37,09 menit; MAE 19,25).
- **Kontribusi fitur Random Forest:** `antrean_di_depan` (51,1%) + gabungan 30 `menu` (29,1%) = **80,2%**, diikuti `jam_pesan` (11,6%), `hari_pesan` (4,5%), dan `jumlah` (3,7%).

---

## 4. Workflow Backend, Database, & Serving Model (Aplikasi Web)

Arsitektur aplikasi lokal (`outputs/kantin-mvp/`): **Python + Flask (`app.py`)**, **SQLite (`instance/kantin.sqlite3`)**, **scikit-learn + joblib (`predictor.py` + `model.joblib`)**, dan **React 18 + Vite (`frontend/dist`)**.

### A. Alur Saat Pembeli Menekan "Buat pesanan sekarang" (`POST /api/pesanan`)
1. **Validasi input:** Backend memeriksa daftar item (1–30 jenis, jumlah 1–100 per menu) dan memastikan semua menu berstatus `tersedia=1` di tabel `menu`.
2. **Transaksi atomik (`BEGIN IMMEDIATE`):**
   - Menghitung `active_ahead` = jumlah pesanan berstatus `menunggu` atau `diproses` **tepat saat itu** (mencegah *race condition* & kebocoran data masa depan).
   - Membuat `nomor_antrean` berurutan dan `token` acak rahasia untuk halaman status pribadi pembeli.
   - Menyimpan baris ke tabel `pesanan` (termasuk `snapshot_json` berisi `items`, `active_ahead`, `diterima_at`), `detail_pesanan`, dan log `riwayat_status`.
3. **Inferensi Model Random Forest (`predictor.py`):**
   - Membentuk 9 fitur numerik (`total_porsi`, `nasi_goreng`, `mi_ayam`, `ayam_geprek`, `menu_lain`, `jumlah_jenis`, `jam`, `hari`, `antrean_aktif_di_depan`) dan memanggil `model.joblib` (`demo-sintetis-1`, model demo terpisah dari notebook).
   - **Transparansi penting:** 30/30 menu papan U’Jasmine saat ini jatuh ke slot `menu_lain` pada model demo, sehingga variasi estimasi live di website terutama dipengaruhi **jumlah porsi**, **antrean aktif di depan**, **jam**, dan **hari**.
   - ***Graceful fallback*:** Jika `model.joblib` rusak/hilang, pesanan tetap tersimpan normal dengan keterangan `"Belum tersedia"`.
4. **Simpan & kembalikan hasil:** `estimasi_menit`, `estimasi_siap`, dan `model_keterangan` disimpan ke SQLite, lalu browser diarahkan ke `/pesanan/<token>`.

### B. Alur Pengelolaan Status Oleh Petugas (`PATCH /api/petugas/pesanan/<id>/status`)
1. **Autentikasi sesi:** Hanya petugas yang sudah login (`/api/petugas/login`, akun demo `admin` / `kantin123`) yang dapat mengakses daftar antrean & menu admin.
2. **Transisi status terkontrol (tidak bisa melompat tahap):**
   - `menunggu` → `diproses` (atau `dibatalkan`)
   - `diproses` → `siap` (atau `dibatalkan`)
   - `siap` → `selesai`
3. **Pencatatan otomatis target ML (`siap_at`):**
   - Tepat saat petugas menekan **Tandai siap**, backend menyimpan timestamp `siap_at` dan mencatat ke `riwayat_status`.
   - Gabungan **`snapshot_json`** (saat masuk) + **`siap_at`** (saat siap) membentuk *data collection loop* untuk pengumpulan data nyata kantin tanpa CCTV.

---

## 5. Workflow Tampilan Website U’Jasmine (Frontend React)

Frontend dibangun dengan **React 18 + Vite** dan dibundel menjadi file statis di `frontend/dist` (disajikan langsung oleh Flask pada port `5000`). Seluruh ikon UI (`lucide-react`) dan 24 ilustrasi makanan vektor (**Microsoft Fluent Emoji** di `foodIcons.js`) dibundel lokal agar tampil tajam **100% offline**.

1. **Halaman Pembeli (`/` — `OrderPage.jsx`):**
   - Menampilkan 30 menu aktif dari `GET /api/menu` lengkap dengan pencarian *real-time* dan 5 filter kategori (`Semua`, `Nasi & Lauk`, `Mie & Tinutuan`, `Pisang & Gorengan`, `Minuman & Es`).
   - Keranjang ringkasan (*sticky*) menghitung porsi & total rupiah secara dinamis, menampilkan *toast* saat item ditambahkan, dan mengirim `POST /api/pesanan`.
   - Menyimpan riwayat pesanan terakhir perangkat pembeli di `localStorage` (`orderHistory.js`), sehingga muncul kotak **Pesanan terakhirmu** di `/` dan tombol pintasan **`Pesanan saya (#nomor)`** di navigasi atas agar pembeli tidak kehilangan halaman status saat pindah tab/halaman.
2. **Halaman Status Pesanan (`/pesanan/<token>` — `StatusPage.jsx`):**
   - Mengambil status dari `GET /api/pesanan/<token>` (internal `id` disembunyikan).
   - Menampilkan **stepper progres 4 tahap** (`Menunggu → Diproses → Siap Diambil → Selesai`), kartu **`ESTIMASI AWAL (RANDOM FOREST)`**, rincian pesanan, hitung mundur refresh otomatis tiap 10 detik, tombol salin tautan, dan pemindah cepat antarpesanan jika pembeli membuat lebih dari 1 pesanan.
3. **Panel Petugas (`/petugas` — `StaffPage.jsx`):**
   - Halaman login petugas → setelah masuk, menampilkan **4 kartu KPI filter** (*Total Aktif*, *Menunggu*, *Diproses*, *Siap Diambil*), toggle **Auto-update 10 detik**, kartu antrean urut masuk (menampilkan nomor, jam masuk, estimasi awal, rincian menu, dan tombol aksi tahap berikutnya), serta manajemen menu (cari, tambah, ubah nama/harga, aktif/nonaktifkan).
4. **Papan Antrean Publik (`/papan` — `BoardPage.jsx`):**
   - Melakukan polling `GET /api/papan/siap` setiap 10 detik dan menampilkan jam digital WITA real-time.
   - Menampilkan **semua pesanan aktif dalam 3 kolom**: **`Menunggu`**, **`Sedang Diproses`**, dan **`Siap Diambil`**.
   - Menjaga privasi: hanya menampilkan nomor antrean dan estimasi/jam ringkas (tanpa rincian menu, nama, atau token), dan nomor otomatis menghilang saat petugas menandai **Selesai** atau **Dibatalkan**.

---

## 6. Workflow Tahap Lanjutan (Menuju Data Nyata & *Retraining*)

Perangkat siap pakai sudah disiapkan terpisah agar tidak mengubah aplikasi demo saat presentasi:
1. **Konfirmasi bersama petugas:** Menggunakan `outputs/Lembar_Konfirmasi_Petugas_Kantin.md` (tabel 30 menu kosong untuk menyepakati kategori proses, daftar menu ikan terlama, kesiapan bahan, dan kebijakan prioritas layanan).
2. **Pengumpulan data nyata:** Menjalankan aplikasi di kantin dengan database bersih untuk merekam `snapshot_json` dan `siap_at` pada jam sepi maupun jam puncak ramai.
3. **Ekspor & *retraining* (`outputs/kantin-mvp/retrain_kantin.py`):**
   - Perintah `ekspor`: membaca SQLite (*read-only*), menyaring pesanan batal/belum siap, mendukung multi-menu (`items_json`), dan mengekspor CSV berlabel `sumber_data=nyata`.
   - Perintah `evaluasi`: mengulangi pembagian kronologis 70/15/15 anti-*leakage*, membandingkan **Random Forest vs Linear Regression vs Median** serta **Konfigurasi Lama vs Konfigurasi Baru** pada partisi uji yang sama, dan menolak mencampur data simulasi dengan data nyata.

---

## 7. Bank Pertanyaan Cepat Dosen & Jawaban Singkat (±20 Detik)

1. **"Algoritma apa yang dipakai?"**
   → Algoritma utama yang dibangun dan dipakai di aplikasi adalah **Random Forest Regression** (100 pohon, `min_samples_leaf=2`, `bootstrap=True`, `max_features=1.0`). **Median** dan **Linear Regression** digunakan di notebook sebagai pembanding evaluasi yang objektif.
2. **"Kenapa di Kaggle Linear Regression (5,01 mnt) lebih rendah MAE-nya dari Random Forest (6,14 mnt)?"**
   → Pada 196 pesanan uji dalam rentang antrean latih (`≤ 10`), Random Forest sebenarnya unggul (**2,54** vs **2,62 mnt**). Ia kalah secara total hanya karena 33 pesanan lonjakan ekstrem (`antrean 11–18`, maks 61,3 mnt) di luar rentang latih (maks 10 antrean / 29,1 mnt), karena pohon keputusan tidak bisa ekstrapolasi.
3. **"Apakah tingkat kesulitan penyiapan sudah masuk variabel X?"**
   → Belum sebagai kolom terpisah; saat ini diwakili identitas `menu` (OHE 30 menu di notebook). Kategori statis per menu perlu disepakati petugas dan tidak menambah informasi independen dari `menu`, sedangkan dari wawancara petugas justru terungkap kondisi dinamis (**bahan *ready* vs belum** + **jumlah petugas aktif**) yang menambah informasi independen untuk tahap data nyata.
4. **"Kenapa belum pakai data lapangan nyata?"**
   → Kantin belum memiliki CCTV maupun pencatatan kasir digital (*cold-start*). Dari lapangan kami mengambil izin, 30 menu asli, dan wawancara petugas; data simulasi dipakai untuk menguji pipeline ML secara objektif, sementara aplikasi web ini dirancang untuk mulai merekam data nyata (`snapshot_json` + `siap_at`).
5. **"Apa bedanya model di notebook dengan model di website?"**
   → Keduanya artefak terpisah: notebook memakai 1.526 baris simulasi (30 menu, 1 menu/baris) untuk eksperimen perbandingan metode; website memakai `model.joblib` (`demo-sintetis-1`) yang mendukung multi-menu untuk demonstrasi integrasi, dengan seluruh 30 menu saat ini masuk slot `menu_lain`.
6. **"Bagaimana mencegah *data leakage*?"**
   → Tiga penjagaan: (1) fitur `X` hanya memakai kondisi saat pesanan masuk (bukan `waktu_siap`), (2) pembagian data kronologis berdasarkan waktu unik + menyaring pesanan yang `waktu_siap`-nya melewati batas periode, dan (3) *One-Hot Encoding* dipelajari hanya dari data latih di dalam `Pipeline`.
7. **"Kalau model error atau file `model.joblib` hilang, apakah kantin jadi lumpuh?"**
   → Tidak. Aplikasi memakai *graceful fallback*: pesanan tetap tercatat, nomor antrean tetap keluar, status dan papan publik 3 kolom tetap berjalan normal, hanya kolom estimasi menampilkan `"Belum tersedia"`.
8. **"Bagaimana kalau pembeli menutup tab atau pindah halaman setelah memesan?"**
   → Riwayat token pesanan terakhir disimpan otomatis di `localStorage` browser pembeli, sehingga muncul tombol **`Pesanan saya (#nomor)`** di header atas dan daftar pesanan terakhir di halaman utama; selain itu papan publik `/papan` juga menampilkan semua nomor aktif (*Menunggu*, *Diproses*, *Siap Diambil*).
