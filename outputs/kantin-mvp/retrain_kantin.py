"""Ekspor data pesanan nyata dari SQLite & evaluasi/retraining model kantin.

Skrip terpisah ini tidak mengubah aplikasi demo (app.py / model.joblib) secara
otomatis. Gunakan setelah data pesanan nyata mulai terkumpul di SQLite, atau
untuk mengevaluasi CSV secara kronologis (Random Forest vs Linear Regression
vs Baseline Median) serta membandingkan konfigurasi fitur lama vs baru pada
partisi uji yang sama.

Contoh penggunaan (di dalam folder outputs/kantin-mvp):
  1. Ekspor SQLite ke CSV:
     .\\.venv\\Scripts\\python.exe retrain_kantin.py ekspor ^
         --db instance/kantin.sqlite3 ^
         --keluaran data_kantin_nyata.csv ^
         --sumber nyata

  2. Evaluasi CSV (dan bandingkan fitur lama vs baru bila tersedia):
     .\\.venv\\Scripts\\python.exe retrain_kantin.py evaluasi ^
         --csv data_kantin_nyata.csv
     (Opsional: --peta-kategori peta_kategori_petugas.csv)
     (Opsional: --simpan-model model_nyata.joblib)
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime
import json
import math
from pathlib import Path
import sqlite3
from typing import Any

import joblib
import numpy as np
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error


SCHEMA_RETRAIN_VERSION = 2
MIN_VALID_ROWS = 30
MIN_UNIQUE_TIMES = 10


def _norm_text(val: Any) -> str:
    return " ".join(str(val or "").strip().split())


def _parse_dt(raw: Any) -> datetime | None:
    text = _norm_text(raw)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
    return None


def _parse_int(raw: Any) -> int | None:
    text = _norm_text(raw)
    if not text:
        return None
    try:
        val = float(text)
    except ValueError:
        return None
    if not math.isfinite(val) or val % 1 != 0:
        return None
    return int(val)


def _parse_float(raw: Any) -> float | None:
    text = _norm_text(raw)
    if not text:
        return None
    try:
        val = float(text)
    except ValueError:
        return None
    return val if math.isfinite(val) else None


def _parse_bool_flag(raw: Any) -> float | None:
    text = _norm_text(raw).lower()
    if not text:
        return None
    if text in {"1", "true", "ya", "ready", "siap"}:
        return 1.0
    if text in {"0", "false", "tidak", "belum", "masak_baru"}:
        return 0.0
    return None


# ==============================================================================
# 1. EKSPOR READ-ONLY DARI SQLITE KE CSV
# ==============================================================================
def ekspor_sqlite(db_path: Path, output_csv: Path, sumber_data: str) -> None:
    """Ekspor pesanan valid (status siap/selesai) dari SQLite tanpa mengubah DB."""
    if not db_path.exists():
        raise FileNotFoundError(f"Database tidak ditemukan: {db_path}")

    sumber = _norm_text(sumber_data).lower()
    if sumber not in {"nyata", "uji_coba"}:
        raise ValueError("--sumber harus 'nyata' atau 'uji_coba'.")

    conn = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT id, nomor_antrean, status, diterima_at, siap_at, snapshot_json "
            "FROM pesanan ORDER BY diterima_at, id"
        ).fetchall()
    finally:
        conn.close()

    exported: list[dict[str, Any]] = []
    skipped = {"belum_siap_atau_batal": 0, "waktu_tidak_valid": 0, "snapshot_tidak_valid": 0}

    for row in rows:
        if row["status"] not in {"siap", "selesai"} or not row["siap_at"]:
            skipped["belum_siap_atau_batal"] += 1
            continue
        t_pesan = _parse_dt(row["diterima_at"])
        t_siap = _parse_dt(row["siap_at"])
        if t_pesan is None or t_siap is None or t_siap < t_pesan:
            skipped["waktu_tidak_valid"] += 1
            continue
        try:
            snap = json.loads(row["snapshot_json"] or "{}")
            items = snap.get("items") or []
            ahead = int(snap.get("active_ahead"))
            if not items or ahead < 0:
                raise ValueError("Item kosong atau antrean negatif")
        except Exception:
            skipped["snapshot_tidak_valid"] += 1
            continue

        clean_items = []
        total_porsi = 0
        for it in items:
            nama = _norm_text(it.get("nama"))
            qty = _parse_int(it.get("jumlah"))
            if not nama or qty is None or qty <= 0:
                clean_items = []
                break
            clean_items.append({"nama": nama, "jumlah": qty})
            total_porsi += qty
        if not clean_items:
            skipped["snapshot_tidak_valid"] += 1
            continue

        durasi_menit = round((t_siap - t_pesan).total_seconds() / 60.0, 4)
        menu_utama = clean_items[0]["nama"] if len(clean_items) == 1 else "__MULTI_MENU__"

        exported.append({
            "pesanan_id": row["id"],
            "waktu_pesan": t_pesan.isoformat(sep=" "),
            "waktu_siap": t_siap.isoformat(sep=" "),
            "waktu_tunggu_menit": durasi_menit,
            "menu": menu_utama,
            "jumlah": total_porsi,
            "jumlah_jenis": len(clean_items),
            "antrean_di_depan": ahead,
            "items_json": json.dumps(clean_items, ensure_ascii=False),
            "jumlah_petugas": snap.get("jumlah_petugas", ""),
            "bahan_siap": snap.get("bahan_siap", ""),
            "kategori_proses": snap.get("kategori_proses", ""),
            "sumber_data": sumber,
        })

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "pesanan_id", "waktu_pesan", "waktu_siap", "waktu_tunggu_menit",
        "menu", "jumlah", "jumlah_jenis", "antrean_di_depan", "items_json",
        "jumlah_petugas", "bahan_siap", "kategori_proses", "sumber_data",
    ]
    with output_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(exported)

    print(f"Ekspor selesai -> {output_csv}")
    print(f"  Total baris di DB     : {len(rows)}")
    print(f"  Diekspor (valid)      : {len(exported)} (sumber_data={sumber})")
    print(f"  Disaring              : {skipped}")


# ==============================================================================
# 2. PEMUATAN, PEMBERSIHAN, & PEMBAGIAN KRONOLOGIS ANTI DATA LEAKAGE
# ==============================================================================
def muat_peta_kategori(path: Path | None) -> dict[str, str]:
    if path is None:
        return {}
    if not path.exists():
        raise FileNotFoundError(f"File peta kategori tidak ditemukan: {path}")
    mapping: dict[str, str] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or not {"menu", "kategori_proses"}.issubset(set(reader.fieldnames)):
            raise ValueError("File peta kategori wajib memiliki kolom 'menu' dan 'kategori_proses'.")
        for row in reader:
            m = _norm_text(row.get("menu")).casefold()
            k = _norm_text(row.get("kategori_proses")).lower()
            if m and k:
                mapping[m] = k
    return mapping


def muat_dan_bersihkan_csv(csv_path: Path, peta_kategori: dict[str, str]) -> tuple[list[dict[str, Any]], bool, int]:
    """Baca CSV (format notebook 1-menu maupun format ekspor multi-menu)."""
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV tidak ditemukan: {csv_path}")

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        cols = set(reader.fieldnames or [])
        wajib = {"waktu_pesan", "waktu_siap", "menu", "jumlah", "antrean_di_depan"}
        kurang = sorted(wajib - cols)
        if kurang:
            raise ValueError(f"Kolom wajib belum tersedia di CSV: {kurang}")
        raw_rows = list(reader)

    # Cegah pencampuran data simulasi dan data nyata.
    sumber_set = {_norm_text(r.get("sumber_data")).lower() for r in raw_rows if _norm_text(r.get("sumber_data"))}
    if "simulasi" in sumber_set and len(sumber_set) > 1:
        raise ValueError(f"Jangan campurkan data simulasi dan data lain: ditemukan {sorted(sumber_set)}.")
    data_simulasi = sumber_set == {"simulasi"}

    records: list[dict[str, Any]] = []
    for row in raw_rows:
        t_pesan = _parse_dt(row.get("waktu_pesan"))
        t_siap = _parse_dt(row.get("waktu_siap"))
        jumlah = _parse_int(row.get("jumlah"))
        ahead = _parse_int(row.get("antrean_di_depan"))
        menu_raw = _norm_text(row.get("menu"))
        if t_pesan is None or t_siap is None or jumlah is None or ahead is None:
            continue
        if jumlah <= 0 or ahead < 0:
            continue
        tunggu = (t_siap - t_pesan).total_seconds() / 60.0
        if tunggu < 0:
            continue

        # Parse daftar item (mendukung multi-menu dari items_json atau 1 menu dari kolom 'menu').
        items: list[dict[str, Any]] = []
        items_json = _norm_text(row.get("items_json"))
        if items_json:
            try:
                parsed = json.loads(items_json)
                for it in parsed:
                    n = _norm_text(it.get("nama"))
                    q = _parse_int(it.get("jumlah"))
                    if n and q and q > 0:
                        items.append({"nama": n, "jumlah": q})
            except Exception:
                items = []
        if not items:
            if not menu_raw:
                continue
            items = [{"nama": menu_raw, "jumlah": jumlah}]

        total_porsi = sum(int(x["jumlah"]) for x in items)
        jumlah_jenis = len(items)

        # Tentukan kategori proses per item (hanya jika tersedia di CSV atau peta konfirmasi petugas).
        kat_row = _norm_text(row.get("kategori_proses")).lower()
        item_kats: dict[str, int] = {}
        for it in items:
            k = peta_kategori.get(it["nama"].casefold()) or kat_row
            if k:
                item_kats[k] = item_kats.get(k, 0) + int(it["jumlah"])

        records.append({
            "waktu_pesan": t_pesan,
            "waktu_siap": t_siap,
            "target": tunggu,
            "items": items,
            "total_porsi": total_porsi,
            "jumlah_jenis": jumlah_jenis,
            "antrean_di_depan": ahead,
            "jam_pesan": t_pesan.hour + t_pesan.minute / 60.0,
            "hari_pesan": float(t_pesan.weekday()),
            "jumlah_petugas": _parse_float(row.get("jumlah_petugas")),
            "bahan_siap": _parse_bool_flag(row.get("bahan_siap")),
            "item_kats": item_kats,
        })

    records.sort(key=lambda r: r["waktu_pesan"])
    dibuang = len(raw_rows) - len(records)
    if len(records) < MIN_VALID_ROWS:
        raise ValueError(
            f"Data valid baru {len(records)} baris (minimal {MIN_VALID_ROWS} baris untuk pembagian kronologis)."
        )
    return records, data_simulasi, dibuang


def bagi_kronologis(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Bagi 70/15/15 menurut waktu_pesan unik + filter batas waktu_siap (anti leakage)."""
    waktu_unik = sorted({r["waktu_pesan"] for r in records})
    if len(waktu_unik) < MIN_UNIQUE_TIMES:
        raise ValueError(f"Perlu minimal {MIN_UNIQUE_TIMES} waktu pemesanan unik; ditemukan {len(waktu_unik)}.")
    cut_latih = waktu_unik[int(len(waktu_unik) * 0.70)]
    cut_uji = waktu_unik[int(len(waktu_unik) * 0.85)]

    latih = [r for r in records if r["waktu_pesan"] < cut_latih and r["waktu_siap"] < cut_latih]
    validasi = [
        r for r in records
        if cut_latih <= r["waktu_pesan"] < cut_uji and r["waktu_siap"] < cut_uji
    ]
    uji = [r for r in records if r["waktu_pesan"] >= cut_uji]
    if min(len(latih), len(validasi), len(uji)) < 2:
        raise ValueError("Salah satu partisi (latih/validasi/uji) terlalu kecil. Tambah data terlebih dahulu.")
    return latih, validasi, uji


# ==============================================================================
# 3. EKSTRAKSI FITUR (DIPELAJARI HANYA DARI DATA LATIH)
# ==============================================================================
class FeatureEncoder:
    """Menyandikan pesanan (1-menu atau multi-menu) tanpa kebocoran data uji."""

    def __init__(self, use_extra_features: bool = False):
        self.use_extra_features = use_extra_features
        self.menu_vocab: list[str] = []
        self.kat_vocab: list[str] = []
        self.has_petugas: bool = False
        self.median_petugas: float = 2.0
        self.has_bahan_siap: bool = False
        self.feature_names: list[str] = []

    def fit(self, train_records: list[dict[str, Any]]) -> "FeatureEncoder":
        menus = sorted({it["nama"].casefold() for r in train_records for it in r["items"]})
        self.menu_vocab = menus
        names = [f"menu__{m}" for m in menus] + [
            "menu__lainnya", "total_porsi", "jumlah_jenis",
            "antrean_di_depan", "jam_pesan", "hari_pesan",
        ]

        if self.use_extra_features:
            kats = sorted({k for r in train_records for k in r["item_kats"].keys()})
            self.kat_vocab = kats
            names.extend(f"kat__{k}" for k in kats)

            petugas_vals = [r["jumlah_petugas"] for r in train_records if r["jumlah_petugas"] is not None]
            if petugas_vals:
                self.has_petugas = True
                self.median_petugas = float(np.median(petugas_vals))
                names.append("jumlah_petugas")

            bahan_vals = [r["bahan_siap"] for r in train_records if r["bahan_siap"] is not None]
            if bahan_vals:
                self.has_bahan_siap = True
                names.extend(["bahan_siap", "bahan_siap_diketahui"])

        self.feature_names = names
        return self

    def transform(self, records: list[dict[str, Any]]) -> np.ndarray:
        menu_idx = {m: i for i, m in enumerate(self.menu_vocab)}
        kat_idx = {k: i for i, k in enumerate(self.kat_vocab)}
        out = np.zeros((len(records), len(self.feature_names)), dtype=float)
        n_menus = len(self.menu_vocab)

        for row_i, r in enumerate(records):
            other_qty = 0.0
            for it in r["items"]:
                key = it["nama"].casefold()
                qty = float(it["jumlah"])
                if key in menu_idx:
                    out[row_i, menu_idx[key]] += qty
                else:
                    other_qty += qty
            col = n_menus
            out[row_i, col] = other_qty
            out[row_i, col + 1] = float(r["total_porsi"])
            out[row_i, col + 2] = float(r["jumlah_jenis"])
            out[row_i, col + 3] = float(r["antrean_di_depan"])
            out[row_i, col + 4] = float(r["jam_pesan"])
            out[row_i, col + 5] = float(r["hari_pesan"])
            col += 6

            if self.use_extra_features:
                for k, qty in r["item_kats"].items():
                    if k in kat_idx:
                        out[row_i, col + kat_idx[k]] += float(qty)
                col += len(self.kat_vocab)
                if self.has_petugas:
                    val = r["jumlah_petugas"]
                    out[row_i, col] = self.median_petugas if val is None else float(val)
                    col += 1
                if self.has_bahan_siap:
                    bval = r["bahan_siap"]
                    out[row_i, col] = 0.0 if bval is None else float(bval)
                    out[row_i, col + 1] = 0.0 if bval is None else 1.0
                    col += 2
        return out


# ==============================================================================
# 4. EVALUASI PERBANDINGAN ADIL (RF vs LR vs MEDIAN, FITUR LAMA vs BARU)
# ==============================================================================
def jalankan_konfigurasi(
    label_konfig: str,
    latih: list[dict[str, Any]],
    validasi: list[dict[str, Any]],
    uji: list[dict[str, Any]],
    use_extra: bool,
) -> dict[str, Any]:
    enc_val = FeatureEncoder(use_extra_features=use_extra).fit(latih)
    x_tr, y_tr = enc_val.transform(latih), np.array([r["target"] for r in latih], dtype=float)
    x_va, y_va = enc_val.transform(validasi), np.array([r["target"] for r in validasi], dtype=float)

    best_leaf, best_val_mae = 2, float("inf")
    val_scores = {}
    for leaf in (2, 5):
        rf_cand = RandomForestRegressor(n_estimators=100, min_samples_leaf=leaf, random_state=2026, n_jobs=-1)
        rf_cand.fit(x_tr, y_tr)
        mae_v = float(mean_absolute_error(y_va, rf_cand.predict(x_va)))
        val_scores[leaf] = mae_v
        if mae_v < best_val_mae:
            best_leaf, best_val_mae = leaf, mae_v

    latih_final = sorted(latih + validasi, key=lambda r: r["waktu_pesan"])
    enc_final = FeatureEncoder(use_extra_features=use_extra).fit(latih_final)
    x_full = enc_final.transform(latih_final)
    y_full = np.array([r["target"] for r in latih_final], dtype=float)
    x_te = enc_final.transform(uji)
    y_te = np.array([r["target"] for r in uji], dtype=float)

    models = {
        "Median": DummyRegressor(strategy="median"),
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(
            n_estimators=100, min_samples_leaf=best_leaf, random_state=2026, n_jobs=-1
        ),
    }

    max_q_train = max(r["antrean_di_depan"] for r in latih_final)
    q_uji = np.array([r["antrean_di_depan"] for r in uji], dtype=int)
    in_range = q_uji <= max_q_train
    out_range = ~in_range

    results: dict[str, dict[str, float | None]] = {}
    fitted_rf = None
    for name, mdl in models.items():
        mdl.fit(x_full, y_full)
        pred = mdl.predict(x_te)
        results[name] = {
            "mae": float(mean_absolute_error(y_te, pred)),
            "rmse": float(math.sqrt(mean_squared_error(y_te, pred))),
            "mae_in_range": float(mean_absolute_error(y_te[in_range], pred[in_range])) if in_range.any() else None,
            "mae_extrap": float(mean_absolute_error(y_te[out_range], pred[out_range])) if out_range.any() else None,
        }
        if name == "Random Forest":
            fitted_rf = mdl

    print(f"\n=== {label_konfig} ({len(enc_final.feature_names)} fitur) ===")
    print(f"  Validasi min_samples_leaf -> 2: {val_scores[2]:.2f} mnt | 5: {val_scores[5]:.2f} mnt (terpilih: {best_leaf})")
    print(f"  Batas antrean data latih+val: <= {max_q_train} (uji dalam rentang: {int(in_range.sum())}, ekstrapolasi: {int(out_range.sum())})")
    print(f"  {'Metode':20s} | {'MAE':>7s} | {'RMSE':>7s} | {'MAE<=MaxQ':>9s} | {'MAE>MaxQ':>8s}")
    print("  " + "-" * 63)
    for name, sc in sorted(results.items(), key=lambda kv: kv[1]["mae"]):
        in_s = f"{sc['mae_in_range']:.2f}" if sc["mae_in_range"] is not None else "-"
        ex_s = f"{sc['mae_extrap']:.2f}" if sc["mae_extrap"] is not None else "-"
        print(f"  {name:20s} | {sc['mae']:7.2f} | {sc['rmse']:7.2f} | {in_s:>9s} | {ex_s:>8s}")

    return {
        "encoder": enc_final,
        "rf_model": fitted_rf,
        "best_leaf": best_leaf,
        "results": results,
        "extra_detected": {
            "kategori_proses": enc_final.kat_vocab,
            "jumlah_petugas": enc_final.has_petugas,
            "bahan_siap": enc_final.has_bahan_siap,
        },
    }


def evaluasi_csv(
    csv_path: Path,
    peta_kategori_path: Path | None,
    simpan_model: Path | None,
    izinkan_simpan_simulasi: bool,
) -> None:
    peta_kat = muat_peta_kategori(peta_kategori_path)
    records, data_simulasi, dibuang = muat_dan_bersihkan_csv(csv_path, peta_kat)
    latih, validasi, uji = bagi_kronologis(records)

    print("===================================================================")
    print("EVALUASI & RETRAINING KANTIN (PEMBAGIAN KRONOLOGIS ANTI-LEAKAGE)")
    print("===================================================================")
    print(f"Sumber CSV      : {csv_path}")
    print(f"Status data     : {'SIMULASI (BUKAN AKURASI KANTIN NYATA)' if data_simulasi else 'NON-SIMULASI (verifikasi asal data)'}")
    print(f"Baris valid     : {len(records)} (dibuang: {dibuang})")
    print(f"Partisi         : Latih={len(latih)} | Validasi={len(validasi)} | Uji={len(uji)}")

    base_out = jalankan_konfigurasi("KONFIGURASI LAMA (Fitur Dasar)", latih, validasi, uji, use_extra=False)

    # Jalankan perbandingan Konfigurasi Baru HANYA jika ada fitur tambahan yang benar-benar terisi.
    has_any_extra = any(
        bool(r["item_kats"]) or r["jumlah_petugas"] is not None or r["bahan_siap"] is not None
        for r in latih
    )
    selected_out = base_out
    selected_label = "konfigurasi_lama"
    if has_any_extra:
        new_out = jalankan_konfigurasi("KONFIGURASI BARU (Dasar + Kondisi/Kategori)", latih, validasi, uji, use_extra=True)
        delta_rf = new_out["results"]["Random Forest"]["mae"] - base_out["results"]["Random Forest"]["mae"]
        print(f"\nPerbandingan pada partisi uji yang sama (Random Forest): delta MAE = {delta_rf:+.2f} menit")
        print(f"  Fitur tambahan terdeteksi: {new_out['extra_detected']}")
        if data_simulasi:
            print("  PERINGATAN: kategori/fitur pada data simulasi berasal dari asumsi, bukan observasi kantin.")
        if new_out["results"]["Random Forest"]["mae"] < base_out["results"]["Random Forest"]["mae"]:
            selected_out = new_out
            selected_label = "konfigurasi_baru"
    else:
        print("\nCatatan: Belum ada kolom/peta fitur tambahan (kategori_proses / jumlah_petugas / bahan_siap) yang terisi; hanya Konfigurasi Lama dievaluasi.")

    if simpan_model is not None:
        if data_simulasi and not izinkan_simpan_simulasi:
            raise ValueError(
                "Menolak menyimpan model dari data simulasi. Gunakan data nyata, atau tambahkan --izinkan-simpan-simulasi secara sadar."
            )
        artifact = {
            "schema_version": SCHEMA_RETRAIN_VERSION,
            "mode": "simulation_retrain" if data_simulasi else "real_canteen_retrain",
            "label": "Model hasil retraining (simulasi)" if data_simulasi else "Model hasil retraining data kantin nyata",
            "selected_config": selected_label,
            "best_min_samples_leaf": selected_out["best_leaf"],
            "feature_names": tuple(selected_out["encoder"].feature_names),
            "encoder": selected_out["encoder"],
            "model": selected_out["rf_model"],
            "test_metrics": selected_out["results"],
            "trained_at": datetime.now().isoformat(timespec="seconds"),
        }
        simpan_model.parent.mkdir(parents=True, exist_ok=True)
        tmp = Path(str(simpan_model) + ".tmp")
        joblib.dump(artifact, tmp, compress=3)
        tmp.replace(simpan_model)
        print(f"\nModel tersimpan di: {simpan_model} ({selected_label})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Ekspor SQLite & evaluasi/retraining model prediksi waktu tunggu kantin.")
    sub = parser.add_subparsers(dest="perintah", required=True)

    p_exp = sub.add_parser("ekspor", help="Ekspor pesanan selesai/siap dari SQLite ke CSV.")
    p_exp.add_argument("--db", type=Path, required=True, help="Lokasi file SQLite (mis. instance/kantin.sqlite3).")
    p_exp.add_argument("--keluaran", type=Path, required=True, help="Lokasi CSV keluaran.")
    p_exp.add_argument("--sumber", default="nyata", choices=["nyata", "uji_coba"], help="Label sumber_data pada CSV.")

    p_eval = sub.add_parser("evaluasi", help="Evaluasi kronologis RF vs LR vs Median (dan fitur lama vs baru).")
    p_eval.add_argument("--csv", type=Path, required=True, help="Lokasi dataset CSV.")
    p_eval.add_argument("--peta-kategori", type=Path, default=None, help="Opsional: CSV menu,kategori_proses hasil konfirmasi petugas.")
    p_eval.add_argument("--simpan-model", type=Path, default=None, help="Opsional: simpan artefak model RF hasil latih ulang.")
    p_eval.add_argument("--izinkan-simpan-simulasi", action="store_true", help="Izinkan menyimpan model meski CSV berlabel simulasi.")

    args = parser.parse_args()
    if args.perintah == "ekspor":
        ekspor_sqlite(args.db, args.keluaran, args.sumber)
    elif args.perintah == "evaluasi":
        evaluasi_csv(args.csv, args.peta_kategori, args.simpan_model, args.izinkan_simpan_simulasi)


if __name__ == "__main__":
    main()
