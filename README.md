# Prediksi Waktu Tunggu dan Pemantauan Antrean Pesanan Kantin Menggunakan Random Forest Regression

Tugas Akhir Mata Kuliah **Machine Learning** — Fakultas Ilmu Komputer, **Universitas Klabat**  
**Mahasiswa:** Marcellyno Benhard Rotty  
**Studi Kasus:** Kantin **U’Jasmine**

> **Catatan repositori:** Repositori ini dipublikasikan pada tahap akhir sebagai kompilasi kode, eksperimen, dan dokumentasi dari pengembangan lokal. Riwayat progres bertahap terdokumentasi pada *ML Project Tracker* mata kuliah.

---

## Ringkasan Proyek

Proyek ini membangun prototipe sistem pencatatan pesanan, pemantauan antrean publik, dan perkiraan waktu tunggu pesanan kantin berbasis **Random Forest Regression**.

- **Target ($Y$):** `waktu_siap - waktu_pesan` dalam menit (mencakup waktu mengantre + penyiapan, bukan waktu pengambilan pembeli).
- **Fitur ($X$) di notebook evaluasi:** informasi yang tersedia saat pesanan masuk — `menu` (One-Hot Encoding 30 menu asli U’Jasmine), `jumlah`, `antrean_di_depan`, `jam_pesan`, dan `hari_pesan`.
- **Validasi lapangan:** izin implementasi, daftar **30 menu asli**, serta wawancara kualitatif petugas kantin yang mengonfirmasi bahwa kesiapan bahan (*ready* vs belum), perbedaan lama masak antar-menu (olahan **ikan** paling lama), jumlah petugas aktif, dan jam ramai (sekitar pukul 12.00) memengaruhi kecepatan layanan.

---

## Hasil Evaluasi Notebook Kaggle (Data Simulasi)

Evaluasi dilakukan pada [data_kantin_simulasi.csv](outputs/data_kantin_simulasi.csv) (**1.526 pesanan simulasi**, 30 menu asli) di [Evaluasi_Random_Forest_Kantin_Kaggle.ipynb](outputs/Evaluasi_Random_Forest_Kantin_Kaggle.ipynb) dengan pembagian **kronologis 70/15/15** (1.068 Latih / 229 Validasi / 229 Uji) + penyaringan batas periode anti-*data leakage*:

| Metode | MAE Uji (menit) | RMSE Uji (menit) | Catatan |
|---|---:|---:|---|
| **Linear Regression** | **5,01** | **8,20** | Terbaik secara total pada pengujian simulasi ini |
| **Random Forest Regression** (`100` pohon, `min_samples_leaf=2`) | **6,14** | **11,38** | Memangkas MAE **39,6%** dibanding Median |
| **Baseline Median** | **10,17** | **17,61** | Pembanding dasar tanpa fitur `X` |

**Temuan *Error Analysis*:**
- Pada **196 dari 229 pesanan uji** dalam rentang antrean data latih (`antrean <= 10`), **Random Forest lebih akurat** (**MAE 2,54 menit** vs Linear Regression **2,62 menit**).
- Pada **33 pesanan uji terakhir** terjadi lonjakan simulasi hingga 18 antrean (maks 61,33 menit), sedangkan data latih maksimum hanya 10 antrean (29,08 menit). Karena pohon keputusan tidak dapat mengekstrapolasi melampaui rentang target latih, prediksi Random Forest mentok di ≤ 24,52 menit sementara Linear Regression tetap naik linear.

> **Batasan Penting:** Seluruh skor evaluasi di atas berasal dari **data simulasi**, bukan pengukuran pesanan nyata di kantin. Model di aplikasi web (`outputs/kantin-mvp/model.joblib`) merupakan **model demonstrasi sintetis terpisah** (`demo-sintetis-1`). Fitur kategori proses penyiapan dan kondisi dinamis (kesiapan bahan / jumlah petugas aktif) masih berupa usulan untuk tahap pengumpulan data nyata.

---

## Struktur Repositori

```text
.
├── outputs/
│   ├── 01-laporan-workflow.pdf ... 05-prd-antrean-kantin.pdf  # Dokumen rancangan & PRD
│   ├── data_kantin_simulasi.csv                               # Dataset simulasi (1.526 baris, 30 menu)
│   ├── Evaluasi_Random_Forest_Kantin_Kaggle.ipynb             # Notebook evaluasi kronologis
│   ├── Lembar_Konfirmasi_Petugas_Kantin.md                    # Lembar konfirmasi 30 menu & aturan prioritas
│   └── kantin-mvp/                                            # Prototipe aplikasi web lokal
│       ├── app.py                                             # Server Flask & REST API
│       ├── backend/                                           # Skema SQLite, helpers, & 30 menu awal
│       ├── predictor.py, train_demo.py, model.joblib          # Serving & pelatihan model demo RF
│       ├── retrain_kantin.py                                  # Skrip ekspor SQLite & retraining data nyata
│       ├── jalankan.bat, requirements.txt                     # Skrip jalankan cepat di Windows
│       └── frontend/                                          # Antarmuka React 18 + Vite (U'Jasmine)
├── work/
│   └── simulate_canteen.py                                    # Skrip generator dataset simulasi
├── Presentasi_ML_Kantin_UKitchen_Jasmine.pptx                 # Slide presentasi (12 slide + speaker notes)
├── Catatan_Workflow_Lengkap_UJasmine.md                       # Ringkasan workflow lengkap end-to-end
├── Alur_Demo_Kantin.txt                                       # Panduan langkah demo presentasi
└── Penjelasan_Alur_Website_Kantin.md                          # Penjelasan alur web & ML
```

---

## Cara Menjalankan Prototipe Lokal (Windows)

1. Pastikan **Python 3.11–3.13** terpasang dan tersedia di `PATH`.
2. Masuk ke folder `outputs/kantin-mvp` lalu klik dua kali **`jalankan.bat`** (saat pertama kali akan membuat `.venv` dan memasang dependensi dari `requirements.txt`).
3. Buka di browser:
   - **Halaman Pembeli:** `http://127.0.0.1:5000`
   - **Panel Petugas:** `http://127.0.0.1:5000/petugas` *(akun demo: `admin` / `kantin123`)*
   - **Papan Antrean Publik (3 Kolom):** `http://127.0.0.1:5000/papan`

Untuk mengubah tampilan React di `outputs/kantin-mvp/frontend`, jalankan `npm install` lalu `npm run build`.

---

## Tahap Lanjutan (Data Nyata & *Retraining*)

Setiap transaksi pada aplikasi otomatis merekam `snapshot_json` (saat pesanan masuk) dan `siap_at` (saat petugas menandai **Siap**) di SQLite. Setelah data nyata terkumpul dan kategori proses dikonfirmasi bersama petugas memakai `outputs/Lembar_Konfirmasi_Petugas_Kantin.md`, ekspor dan evaluasi ulang dapat dijalankan melalui:

```powershell
cd outputs\kantin-mvp
.\.venv\Scripts\python.exe retrain_kantin.py ekspor --db instance\kantin.sqlite3 --keluaran data_kantin_nyata.csv --sumber nyata
.\.venv\Scripts\python.exe retrain_kantin.py evaluasi --csv data_kantin_nyata.csv
```
