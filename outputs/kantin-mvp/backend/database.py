"""Koneksi dan penyiapan database SQLite."""
import sqlite3
from pathlib import Path

from flask import current_app, g
from .menu_awal import MENU_AWAL


def db():
    """Gunakan satu koneksi untuk setiap permintaan HTTP."""
    if 'db' not in g:
        g.db = sqlite3.connect(current_app.config['DATABASE'], timeout=10)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys=ON')
    return g.db


def close_db(error):
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()


def init_database(app):
    """Buat tabel dan isi menu awal ketika database masih kosong."""
    Path(app.config['DATABASE']).parent.mkdir(parents=True, exist_ok=True)
    with app.app_context():
        conn = db()
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS menu (
            id INTEGER PRIMARY KEY, nama TEXT NOT NULL UNIQUE COLLATE NOCASE,
            harga INTEGER NOT NULL CHECK(harga >= 0), tersedia INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS pesanan (
            id INTEGER PRIMARY KEY AUTOINCREMENT, nomor_antrean INTEGER NOT NULL UNIQUE,
            token TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
            diterima_at TEXT NOT NULL, siap_at TEXT, estimasi_menit REAL,
            estimasi_siap TEXT, snapshot_json TEXT NOT NULL, model_keterangan TEXT
        );
        CREATE TABLE IF NOT EXISTS detail_pesanan (
            id INTEGER PRIMARY KEY, pesanan_id INTEGER NOT NULL REFERENCES pesanan(id),
            menu_id INTEGER NOT NULL REFERENCES menu(id), nama TEXT NOT NULL,
            harga INTEGER NOT NULL, jumlah INTEGER NOT NULL CHECK(jumlah > 0)
        );
        CREATE TABLE IF NOT EXISTS riwayat_status (
            id INTEGER PRIMARY KEY, pesanan_id INTEGER NOT NULL REFERENCES pesanan(id),
            status TEXT NOT NULL, waktu TEXT NOT NULL
        );
        ''')
        if conn.execute('SELECT COUNT(*) FROM menu').fetchone()[0] == 0:
            conn.executemany('INSERT INTO menu (nama,harga) VALUES (?,?)', MENU_AWAL)
        conn.commit()
