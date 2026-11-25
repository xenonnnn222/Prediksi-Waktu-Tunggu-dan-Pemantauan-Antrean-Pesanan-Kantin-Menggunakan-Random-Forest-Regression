import csv
import heapq
import json
import random
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'outputs' / 'kantin-mvp'))
from backend.menu_awal import MENU_AWAL

rng = random.Random(20261118)
menus = [name for name, _ in MENU_AWAL]


def base_minutes(menu):
    # Asumsi simulasi berdasarkan cara sajian, bukan hasil observasi.
    if menu.startswith('Air Mineral'):
        return (0.4, 1.5)
    if menu.startswith('Es ') or menu in ('Gohu', 'Kolak Kacang Ijo'):
        return (1, 4)
    if menu.startswith(('Nasi Goreng', 'Mie ', 'Indomie')):
        return (4, 10)
    return (2, 7)


rows = []
for day in range(30):
    opening = datetime(2026, 10, 1, 9) + timedelta(days=day)
    arrivals = set()
    for _ in range(rng.randint(40, 64)):
        # Sesi siang sengaja lebih ramai. Hari tetap memiliki durasi layanan bervariasi.
        minute = rng.triangular(90, 290, 190) if rng.random() < 0.60 else rng.uniform(0, 360)
        arrivals.add(round(minute * 60))
    workers = [opening] * rng.choice([2, 2, 3])
    outstanding = []
    day_factor = rng.uniform(0.85, 1.2)
    for seconds in sorted(arrivals):
        ordered = opening + timedelta(seconds=seconds)
        while outstanding and outstanding[0] <= ordered:
            heapq.heappop(outstanding)
        ahead = len(outstanding)
        menu = rng.choice(menus)
        quantity = rng.choices([1, 2, 3, 4], [70, 20, 8, 2])[0]
        start = max(ordered, heapq.heappop(workers))
        low, high = base_minutes(menu)
        duration = rng.uniform(low, high) * day_factor * (1 + 0.24 * (quantity - 1))
        ready = start + timedelta(seconds=max(1, round(duration * 60)))
        heapq.heappush(workers, ready)
        heapq.heappush(outstanding, ready)
        rows.append((ordered.isoformat(' '), ready.isoformat(' '), menu, quantity, ahead, 'simulasi'))

out = root / 'outputs' / 'data_kantin_simulasi.csv'
with out.open('w', encoding='utf-8', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['waktu_pesan', 'waktu_siap', 'menu', 'jumlah', 'antrean_di_depan', 'sumber_data'])
    writer.writerows(rows)

counts = Counter(row[2] for row in rows)
assert set(counts) == set(menus)
assert len({row[0] for row in rows}) == len(rows)
assert all(row[0] < row[1] and row[4] >= 0 for row in rows)
print(f'{len(rows)} pesanan | {len(counts)} menu | {min(counts.values())}–{max(counts.values())} catatan per menu')
print(f'Antrean tertinggi: {max(row[4] for row in rows)}')

# Kenali CSV berlabel simulasi meskipun dibaca menggunakan mode CSV.
path = root / 'outputs' / 'Evaluasi_Random_Forest_Kantin_Kaggle.ipynb'
notebook = json.loads(path.read_text(encoding='utf-8'))
for cell in notebook['cells']:
    source = ''.join(cell['source'])
    source = source.replace('3. Jika sudah memiliki data nyata, lampirkan dataset CSV sebagai input notebook.', '3. Untuk memakai `data_kantin_simulasi.csv` dari menu kantin atau CSV hasil pencatatan nyata, lampirkan file CSV sebagai input notebook.')
    source = source.replace('if SUMBER_DATA == "simulasi":\n    # Data ini', 'data_simulasi = SUMBER_DATA == "simulasi"\nif data_simulasi:\n    # Data ini')
    source = source.replace('    print("SUMBER: CSV. Pastikan isinya adalah hasil pencatatan yang benar.")', '    if "sumber_data" in data.columns:\n        sumber = data["sumber_data"].astype("string").str.strip().str.lower()\n        data_simulasi = bool(sumber.eq("simulasi").any())\n        if data_simulasi and not sumber.eq("simulasi").fillna(False).all():\n            raise ValueError("Pisahkan data simulasi dan data nyata sebelum evaluasi.")\n    print("SUMBER: CSV SIMULASI" if data_simulasi else "SUMBER: CSV; verifikasi asal data.")')
    source = source.replace('print("Sumber data:", SUMBER_DATA.upper())\nif SUMBER_DATA == "simulasi":', 'print("Sumber data:", "SIMULASI" if data_simulasi else "CSV")\nif data_simulasi:')
    if 'Data contoh dari menu kantin berlabel' not in source:
        source = source.replace('Dataset nyata belum disertakan.', 'Data contoh dari menu kantin berlabel `sumber_data=simulasi`. Jangan gabungkan dengan catatan nyata. Pilihan menu pada CSV simulasi disampling merata untuk menguji semua menu. Jam ramai, jumlah petugas, dan rentang penyiapan merupakan asumsi pembuat data.\n\nDataset nyata belum disertakan.')
    source = source.replace('latih = df[df["waktu_pesan"] < cut_latih].copy()', 'latih = df[(df["waktu_pesan"] < cut_latih) & (df["waktu_siap"] < cut_latih)].copy()')
    source = source.replace('validasi = df[(df["waktu_pesan"] >= cut_latih) & (df["waktu_pesan"] < cut_uji)].copy()', 'validasi = df[(df["waktu_pesan"] >= cut_latih) & (df["waktu_pesan"] < cut_uji)\n              & (df["waktu_siap"] < cut_uji)].copy()')
    source = source.replace('# ke set yang berbeda. Data yang lebih baru dipakai untuk validasi dan uji.', '# ke set yang berbeda. Data yang lebih baru dipakai untuk validasi dan uji.\n# Durasi yang belum diketahui saat periode berikutnya mulai tidak ikut pelatihan.')
    cell['source'] = source.splitlines(keepends=True)
path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
