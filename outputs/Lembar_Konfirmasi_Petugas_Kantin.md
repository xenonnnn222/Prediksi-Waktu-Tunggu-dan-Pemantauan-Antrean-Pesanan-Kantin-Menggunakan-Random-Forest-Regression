# Lembar Konfirmasi Operasional & Daftar 30 Menu — Kantin U’Kitchen Jasmine

Dokumen ini digunakan untuk mengonfirmasi definisi proses penyiapan, menu yang paling lama dimasak, kesiapan bahan, dan kebijakan prioritas layanan langsung bersama petugas/pengelola kantin **sebelum** memulai pencatatan data nyata dan pelatihan ulang (*retraining*) model.

> **Penting:** Seluruh kolom isian di bawah sengaja dikosongkan agar diisi berdasarkan keterangan resmi petugas kantin, bukan asumsi peneliti.

---

## Informasi Sesi Konfirmasi

| Bidang | Isian |
|---|---|
| Tanggal konfirmasi | `____ / ____ / 2026` |
| Nama petugas / pengelola | |
| Jam buka – jam tutup kantin | |
| Jam paling ramai (puncak antrean) | *(wawancara awal: sekitar pukul 12.00)* |
| Jumlah petugas saat normal vs saat jam ramai | Normal: `___` orang \| Ramai: `___` orang |

---

## Bagian A — Konfirmasi Kategori Proses & Kesiapan Bahan (30 Menu Asli)

**Petunjuk pengisian bersama petugas:**
- **Kategori Proses (usulan awal, boleh diubah petugas):**
  - `S` = **Siap Disajikan** (langsung ambil/kemas)
  - `R` = **Dirakit** (tinggal tuang/campur/tata dari bahan siap)
  - `M` = **Dimasak** (perlu dimasak/digoreng/direbus baru saat dipesan)
- **Menu "Ikan" Terlama?** Tandai `Ya` bila menu ini termasuk yang dimaksud petugas pada wawancara awal sebagai menu paling lama dimasak.
- **Kesiapan Bahan Berubah?** Tandai `Ya` bila untuk menu yang sama, waktunya bisa jauh lebih cepat saat bahan/lauk sudah *ready* dan lebih lama saat harus dimasak dari awal.

| No | Nama Menu (Papan Kantin) | Harga (Rp) | Kategori Proses (`S` / `R` / `M`) | Menu "Ikan" Terlama? (`Ya`/`Tdk`) | Kesiapan Bahan Berubah? (`Ya`/`Tdk`) | Catatan Petugas |
|---:|---|---:|:---:|:---:|:---:|---|
| 1 | Nasi Campur Ikan | 20.000 | | | | |
| 2 | Nasi Campur Ayam | 25.000 | | | | |
| 3 | Nasi Ayam Geprek | 25.000 | | | | |
| 4 | Nasi Tempe Penyet | 15.000 | | | | |
| 5 | Nasi Goreng Ayam | 20.000 | | | | |
| 6 | Nasi Goreng Cakalang | 18.000 | | | | |
| 7 | Nasi Goreng Roa | 18.000 | | | | |
| 8 | Nasi Goreng Telur | 15.000 | | | | |
| 9 | Tinutuan & Miedal | 15.000 | | | | |
| 10 | Mie Kuah Cakalang | 15.000 | | | | |
| 11 | Mie Goreng Cakalang | 15.000 | | | | |
| 12 | Pisang Spatu | 10.000 | | | | |
| 13 | Pisang Goroho Stik | 10.000 | | | | |
| 14 | Pisang Goroho Tepung | 10.000 | | | | |
| 15 | Pisang Coklat Keju | 15.000 | | | | |
| 16 | Tahu Isi | 3.000 | | | | |
| 17 | Tempe Goreng | 3.000 | | | | |
| 18 | Indomie Goreng Single | 10.000 | | | | |
| 19 | Indomie Kuah Single | 10.000 | | | | |
| 20 | Indomie Goreng Double | 15.000 | | | | |
| 21 | Indomie Kuah Double | 15.000 | | | | |
| 22 | Air Mineral Besar | 10.000 | | | | |
| 23 | Air Mineral Sedang | 5.000 | | | | |
| 24 | Air Mineral Kecil | 3.000 | | | | |
| 25 | Es Kepal | 15.000 | | | | |
| 26 | Es Kacang | 15.000 | | | | |
| 27 | Es Palu Butung | 15.000 | | | | |
| 28 | Es Cendeol *(cek ejaan papan)* | 10.000 | | | | |
| 29 | Gohu | 10.000 | | | | |
| 30 | Kolak Kacang Ijo | 10.000 | | | | |

---

## Bagian B — Konfirmasi Aturan Operasional & Kebijakan Prioritas

1. **Definisi waktu "Siap" (`siap_at`):**
   - Apakah petugas sepakat tombol **Siap** ditekan segera setelah makanan selesai disiapkan dan diletakkan di meja serah (bukan menunggu pembeli datang mengambil)?
   - Jawaban / catatan: `____________________________________________________________`

2. **Kebijakan prioritas layanan (mis. dosen / tamu / pesanan tertentu):**
   - Apakah ada aturan prioritas resmi di kantin? `[ ] Ya   [ ] Tidak`
   - Jika Ya, siapa yang berhak menentukan prioritas dan bagaimana alurnya?
   - Jawaban / catatan: `____________________________________________________________`

3. **Kelayakan pencatatan kondisi dinamis (hasil wawancara awal):**
   - Apakah petugas bersedia/praktis mengisi **jumlah petugas aktif** di awal shift (atau saat jumlah petugas berubah)? `[ ] Ya   [ ] Tidak`
   - Apakah petugas praktis menandai status **bahan ready / perlu masak baru** untuk menu tertentu saat berubah? `[ ] Ya   [ ] Tidak`

4. **Peringatan pesanan lama (usulan lanjutan):**
   - Setelah berapa menit pesanan yang masih *Menunggu* atau *Diproses* perlu diberi tanda peringatan di layar petugas? `_____ menit`

---

## Bagian C — Format CSV Hasil Konfirmasi (Untuk Input `--peta-kategori`)

Setelah Bagian A selesai disepakati petugas, salin hasilnya ke file CSV sederhana (misalnya `peta_kategori_petugas.csv`) dengan kolom berikut untuk dipakai langsung oleh skrip `outputs/kantin-mvp/retrain_kantin.py`:

```csv
menu,kategori_proses
Nasi Campur Ikan,dimasak
Air Mineral Besar,siap_disajikan
```

*(Contoh 2 baris di atas sekadar format kolom — isi lengkapnya harus mengikuti hasil kesepakatan petugas pada Bagian A.)*

---

## Bagian D — Checklist Sebelum Mulai Mengumpulkan Data Nyata

- [ ] Database demo/uji coba sudah dipisahkan agar **tidak tercampur** dengan pesanan nyata.
- [ ] Jam sistem komputer kantin sudah sesuai zona waktu setempat (WITA / UTC+08:00).
- [ ] Petugas memahami alur status: **Menunggu → Diproses → Siap → Selesai** (atau **Dibatalkan** jika batal).
- [ ] Periode pengumpulan mencakup **jam sepi maupun jam puncak ramai** (termasuk sekitar pukul 12.00) selama beberapa hari kerja agar rentang antrean data latih mewakili kondisi nyata.
- [ ] Setelah data nyata terkumpul, ekspor dan evaluasi ulang memakai `outputs/kantin-mvp/retrain_kantin.py` tanpa mencampurkan baris berlabel `simulasi`.
