"""Prediksi waktu tunggu berbasis Random Forest untuk MVP kantin.

Model yang disertakan dibuat dari data simulasi, bukan observasi kantin.
Hanya muat berkas joblib dari sumber tepercaya karena formatnya dapat
mengeksekusi kode ketika dibuka.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import joblib

MODEL_PATH = Path(__file__).resolve().parent / "model.joblib"
SCHEMA_VERSION = 1
FEATURE_NAMES = (
    "total_porsi", "nasi_goreng", "mi_ayam", "ayam_geprek", "menu_lain",
    "jumlah_jenis", "jam", "hari", "antrean_aktif_di_depan",
)

_cached_signature: tuple[int, int] | None = None
_cached_artifact: dict[str, Any] | None = None


def features_for(items: list[dict[str, Any]], active_ahead: int, at_time: datetime) -> list[float]:
    """Ubah snapshot pesanan menjadi fitur numerik yang tersedia saat diterima."""
    counts = {"nasi_goreng": 0, "mi_ayam": 0, "ayam_geprek": 0, "menu_lain": 0}
    for item in items:
        name = " ".join(str(item["nama"]).casefold().split())
        quantity = int(item["jumlah"])
        if quantity < 1:
            raise ValueError("Jumlah harus bilangan positif")
        if name == "nasi goreng":
            key = "nasi_goreng"
        elif name in {"mi ayam", "mie ayam"}:
            key = "mi_ayam"
        elif name == "ayam geprek":
            key = "ayam_geprek"
        else:
            key = "menu_lain"
        counts[key] += quantity
    if not items or active_ahead < 0:
        raise ValueError("Pesanan dan jumlah antrean harus valid")
    return [
        float(sum(counts.values())), float(counts["nasi_goreng"]),
        float(counts["mi_ayam"]), float(counts["ayam_geprek"]),
        float(counts["menu_lain"]), float(len(items)),
        float(at_time.hour + at_time.minute / 60.0),
        float(at_time.weekday()), float(active_ahead),
    ]


def _load_model() -> dict[str, Any] | None:
    """Muat ulang jika model diganti; kembalikan None bila model tidak tersedia."""
    global _cached_signature, _cached_artifact
    try:
        stat = MODEL_PATH.stat()
        signature = (stat.st_mtime_ns, stat.st_size)
        if signature != _cached_signature:
            data = joblib.load(MODEL_PATH)
            if (not isinstance(data, dict) or data.get("schema_version") != SCHEMA_VERSION
                    or tuple(data.get("feature_names", ())) != FEATURE_NAMES
                    or not hasattr(data.get("pipeline"), "predict")):
                raise ValueError("Format model tidak cocok")
            _cached_artifact, _cached_signature = data, signature
        return _cached_artifact
    except Exception:
        # Pesanan harus tetap dapat diproses jika file model tidak tersedia/rusak.
        _cached_signature, _cached_artifact = None, None
        return None


def predict_minutes(items: list[dict[str, Any]], active_ahead: int, at_time: datetime) -> float | None:
    """Kembalikan estimasi menit, atau None jika prediksi tidak tersedia."""
    artifact = _load_model()
    if artifact is None:
        return None
    try:
        features = features_for(items, active_ahead, at_time)
        prediction = float(artifact["pipeline"].predict([features])[0])
        if not (0 < prediction < float("inf")):
            return None
        return round(prediction, 1)
    except Exception:
        return None


def model_info() -> dict[str, Any]:
    """Status aman untuk ditampilkan API/UI tanpa membocorkan lokasi file."""
    artifact = _load_model()
    if artifact is None:
        return {"available": False, "mode": "unavailable", "label": "Estimasi belum tersedia"}
    return {
        "available": True,
        "mode": artifact.get("mode", "unknown"),
        "label": artifact.get("label", "Model prediksi"),
        "version": artifact.get("version", "unknown"),
    }
