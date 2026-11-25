# Kantin U’Kitchen Jasmine: Penjelasan Alur Website, Workflow, dan Machine Learning

## 1. Masalah yang Ada & Temuan Wawancara Kantin

Di Kantin U’Kitchen Jasmine, pembeli sering tidak tahu kapan pesanannya akan siap diambil, sehingga menunggu di depan loket atau bolak-balik bertanya. Di sisi operasional, kantin belum memiliki CCTV maupun pencatatan digital riwayat durasi pesanan. Izin implementasi dan daftar **30 menu asli** papan kantin sudah diperoleh.

Dari **wawancara kualitatif langsung dengan petugas kantin**, ditemukan tiga fakta lapangan:
1. **Kesiapan bahan (*ready* atau belum)** adalah faktor utama cepat/lambatnya pesanan selesai (*"tergantung bahan, kalau sudah ready cepat"*).
2. **Durasi memasak antar-menu berbeda**, dengan menu berbahan **ikan** disebut memakan waktu proses paling lama.
3. **Jumlah petugas yang bekerja**, **jam ramai** (sekitar pukul 12.00), dan **ketersediaan bahan makanan** dapat menyebabkan keterlambatan pesanan.

---

## 2. Solusi & Workflow Operasional di Website

Prototipe web lokal (`Python`, `Flask`, `SQLite`, `React`, `scikit-learn`) memiliki tiga halaman utama: **Pembeli (`/`)**, **Petugas (`/petugas`)**, dan **Papan Publik (`/papan`)**.

**Alur Operasional:**
1. **Pemesanan (`/`):** Pembeli memilih satu atau lebih menu (dari 30 menu asli kantin) beserta jumlahnya lalu menekan **Buat pesanan**.
2. **Pencatatan & Potret Antrean:** Dalam satu transaksi SQLite (`BEGIN IMMEDIATE`), sistem memberi nomor antrean unik, mencatat waktu masuk (`diterima_at`), dan menyimpan potret antrean aktif saat itu (`snapshot_json`).
3. **Estimasi Awal (Model ML):** Sistem menjalankan model **Random Forest Regression** untuk menghasilkan **ESTIMASI AWAL** (menit & perkiraan jam siap). Jika file model tidak tersedia, pesanan tetap tercatat dengan keterangan estimasi belum tersedia (*graceful fallback*).
4. **Pantau Status (`/pesanan/<token>`):** Pembeli menyimpan tautan status pribadi yang diperbarui otomatis setiap 10 detik.
5. **Proses Petugas (`/petugas`):** Petugas mengelola urutan pesanan dan mengubah status: **Menunggu → Diproses → Siap → Selesai** (atau **Dibatalkan**). Saat petugas menekan **Siap**, sistem otomatis menyimpan `siap_at` di SQLite.
6. **Papan Publik (`/papan`):** Nomor pesanan berstatus **Siap** tampil otomatis (refresh tiap 10 detik) dan menghilang saat petugas menandai **Selesai**.

> **Koneksi ke Machine Learning (*Data Collection Loop*):** Kombinasi `snapshot_json` (kondisi saat masuk) dan `siap_at` (saat ditandai siap) menjadikan aplikasi ini fondasi pengumpulan data nyata kantin tanpa CCTV untuk pelatihan ulang (*retraining*) model di tahap berikutnya.

---

## 3. Workflow Data & Model Machine Learning (Notebook Kaggle)

Eksperimen dilakukan di `outputs/Evaluasi_Random_Forest_Kantin_Kaggle.ipynb` dengan alur anti kebocoran data (*data leakage prevention*):

1. **Data:** `outputs/data_kantin_simulasi.csv` berisi **1.526 pesanan simulasi** berbasis **30 menu asli** (satu jenis menu per baris dengan jumlah porsi bervariasi). Jam ramai, jumlah pekerja, dan durasi merupakan asumsi simulator.
2. **Validasi & Pembersihan:** Memeriksa data kosong, tipe angka, jumlah porsi positif, antrean nonnegatif, dan waktu tunggu nonnegatif (`0` baris terbuang pada CSV simulasi).
3. **Target & Fitur:**
   - **Target ($Y$):** `waktu_siap - waktu_pesan` dalam menit (mencakup waktu antre + penyiapan, berbeda dari waktu pengambilan pelanggan).
   - **Fitur ($X$):** hanya informasi yang tersedia saat pesanan masuk — `menu`, `jumlah`, `antrean_di_depan`, `jam_pesan`, `hari_pesan`. `waktu_siap` tidak pernah masuk ke fitur `X`.
4. **Pembagian Kronologis (70% / 15% / 15%):** Data diurutkan berdasarkan waktu unik menjadi **1.068 Latih**, **229 Validasi**, dan **229 Uji** (semua 30 menu terwakili di ketiga partisi), serta menyaring baris latih/validasi yang `waktu_siap`-nya melampaui batas periode agar informasi masa depan tidak bocor.
5. **Preprocessing & Pemilihan Parameter:** `OneHotEncoder(handle_unknown="ignore")` untuk 30 `menu` dibungkus dalam `Pipeline` dan hanya dipelajari dari data latih. Pemilihan `min_samples_leaf` (`2` vs `5`) dilakukan pada data validasi → terpilih **`min_samples_leaf = 2`** (MAE validasi **1,76 menit** vs `2,06 menit` untuk `5`).
6. **Pelatihan Ulang & Uji Adil:** Ketiga metode dilatih ulang pada gabungan latih + validasi (`1.297` pesanan) lalu diuji sekali pada **229 data uji yang sama**.
   - **Algoritma Utama:** **Random Forest Regression** (`n_estimators=100`, `min_samples_leaf=2`, `bootstrap=True`, dan bawaan scikit-learn `max_features=1.0` sehingga semua fitur dipertimbangkan di tiap percabangan).
   - **Pembanding:** **Linear Regression** dan **Baseline Median**.

---

## 4. Hasil Evaluasi Kaggle (Data Simulasi) & Error Analysis

| Metode | MAE Uji (menit) | RMSE Uji (menit) | Catatan |
|---|---:|---:|---|
| **Linear Regression** | **5,01** | **8,20** | Terbaik secara keseluruhan pada pengujian simulasi ini |
| **Random Forest Regression** | **6,14** | **11,38** | Memangkas MAE **39,6%** dibanding Median |
| **Baseline Median** | **10,17** | **17,61** | Pembanding dasar tanpa fitur `X` |

**Mengapa Random Forest kalah di skor total, padahal unggul di kondisi normal?**
- Pada data latih + validasi (`1.297` pesanan), `antrean_di_depan` maksimum hanya **10** (waktu tunggu maks **29,08 menit**).
- Pada **196 dari 229 pesanan uji** yang masih berada dalam rentang latih (`antrean_di_depan <= 10`), **Random Forest justru lebih akurat dari Linear Regression** (**MAE 2,54 menit** vs **2,62 menit**).
- Namun pada **33 pesanan uji terakhir**, simulator memunculkan lonjakan ekstrem hingga **18 antrean** (waktu tunggu hingga **61,33 menit**). Karena pohon keputusan tidak dapat **mengekstrapolasi** melampaui nilai target latih, prediksi Random Forest mentok di **≤ 24,52 menit** (MAE subkelompok ini 27,56 menit), sedangkan Linear Regression tetap mengekstrapolasi secara linear (hingga 37,09 menit; MAE 19,25 menit).
- Pada data simulasi ini, 80,2% kontribusi fitur Random Forest berasal dari `antrean_di_depan` (51,1%) dan gabungan 30 `menu` (29,1%), diikuti `jam_pesan` (11,6%), `hari_pesan` (4,5%), dan `jumlah` (3,7%).

---

## 5. Menjawab Pertanyaan Dosen: Tingkat Kesulitan Menu pada Variabel X

- **Status aktual:** Tingkat kesulitan atau kategori proses penyiapan **belum** menjadi kolom fitur tersendiri di `X`; perbedaan menu saat ini diwakili secara tidak langsung oleh identitas `menu` (One-Hot Encoding 30 menu di notebook).
- **Kategori statis vs kondisi dinamis:**
  - Usulan kategori proses statis (*siap disajikan*, *dirakit*, *dimasak*) harus didefinisikan bersama petugas kantin (di simulator, `Nasi Campur Ikan` masuk 2–7 menit, padahal wawancara menyebut menu **ikan** paling lama). Kategori statis membantu pengelompokan, **tetapi tidak menambah informasi independen** dari identitas `menu` bila pemetaannya tetap.
  - Berdasarkan wawancara kantin (*"tergantung bahan kalau sudah ready"* + jumlah petugas), **kondisi dinamis yang diketahui saat pesanan masuk** (status kesiapan bahan dan jumlah petugas aktif) **menambah informasi independen** meski nama menunya sama.
- Fitur tersebut masih berupa **usulan** (belum diterapkan). Saat diuji nanti, konfigurasi lama dan baru wajib dibandingkan pada partisi uji yang sama dan dijelaskan sumber datanya secara jujur.

---

## 6. Batasan & Pemisahan Artefak (Wajib Disampaikan)

- **Simulasi ≠ Kantin Nyata:** Seluruh angka evaluasi Kaggle berasal dari **data simulasi**, bukan observasi durasi kantin sungguhan. Akurasi dan dampak operasional di Kantin U’Kitchen Jasmine belum dibuktikan.
- **Model Notebook vs Model Demo Aplikasi:** Keduanya artefak terpisah. Model demo di aplikasi (`model.joblib`, versi `demo-sintetis-1`) dilatih oleh `train_demo.py` pada 2.500 sampel sintetis untuk mendukung multi-menu; saat ini seluruh **30 menu** di `menu_awal.py` masuk ke slot `menu_lain` pada model demo sehingga perubahan prediksi live saat demo terutama mencerminkan **jumlah porsi**, **antrean aktif di depan**, **jam**, dan **hari**.
- **Langkah lanjutan:** Konfirmasi definisi kategori proses, menu ikan, dan kebijakan prioritas layanan bersama petugas → rekam data pesanan nyata lewat aplikasi (mencakup jam puncak ramai) → selaraskan fitur aplikasi dengan 30 menu aktual → ulangi perbandingan Random Forest, Linear Regression, dan Median pada data asli.
