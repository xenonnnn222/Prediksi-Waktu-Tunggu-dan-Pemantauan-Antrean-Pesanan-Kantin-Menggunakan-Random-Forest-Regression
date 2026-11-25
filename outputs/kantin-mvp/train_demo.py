"""Latih model DEMO dari data sintetis; tidak merepresentasikan kantin nyata.

Jalankan: python train_demo.py
File model.joblib dibuat di direktori yang sama dengan skrip ini.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import random

import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

from predictor import FEATURE_NAMES, MODEL_PATH, SCHEMA_VERSION, features_for


def main() -> None:
    rng = random.Random(2026)
    menus = ["Nasi Goreng", "Mi Ayam", "Ayam Geprek", "Menu Lain"]
    # Sampel sintetis untuk demonstrasi integrasi, bukan pengukuran riil.
    start = datetime(2025, 1, 6, 8, 0, tzinfo=timezone.utc)
    x, y = [], []
    for _ in range(2500):
        names = rng.sample(menus, k=rng.randint(1, 3))
        items = [{"nama": name, "jumlah": rng.randint(1, 3)} for name in names]
        ahead = rng.randint(0, 20)
        at_time = start + timedelta(days=rng.randrange(120), minutes=rng.randrange(0, 600))
        row = features_for(items, ahead, at_time)
        prep = 4.5 + 2.5 * row[1] + 2.1 * row[2] + 2.8 * row[3] + 2.0 * row[4]
        congestion = 1.1 * ahead + (2.0 if 11 <= at_time.hour < 13 else 0.0)
        target = max(1.0, prep + congestion + rng.gauss(0, 1.8))
        x.append(row)
        y.append(target)

    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("regressor", RandomForestRegressor(n_estimators=100, min_samples_leaf=2,
                                             random_state=2026, n_jobs=-1)),
    ])
    pipeline.fit(x, y)
    artifact = {
        "schema_version": SCHEMA_VERSION,
        "feature_names": FEATURE_NAMES,
        "pipeline": pipeline,
        "mode": "synthetic_demo",
        "label": "Model demonstrasi - dilatih dengan data simulasi",
        "version": "demo-sintetis-1",
    }
    temp = Path(str(MODEL_PATH) + ".tmp")
    joblib.dump(artifact, temp, compress=3)
    temp.replace(MODEL_PATH)
    print(f"Model demo sintetis dibuat di: {MODEL_PATH}")
    print("Prediksi hanya demonstrasi; bukan akurasi kantin sebenarnya.")


if __name__ == "__main__":
    main()
