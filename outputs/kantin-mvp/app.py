"""MVP lokal antrean kantin. Data dan kredensial contoh bukan untuk produksi."""
import json
import logging
import os
from pathlib import Path
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from flask import Flask, jsonify, send_from_directory, session

from backend.database import db, close_db, init_database
from backend.helpers import error, json_object, staff_required

try:
    from predictor import predict_minutes, model_info
except ImportError:
    def predict_minutes(*args, **kwargs):
        return None
    def model_info():
        return {'available': False, 'kind': 'unavailable'}

BASE = Path(__file__).resolve().parent
DIST = BASE / 'frontend' / 'dist'  # hasil `npm run build` dari React
DB_PATH = os.environ.get('DB_PATH', str(BASE / 'instance' / 'kantin.sqlite3'))
LOCAL_TZ = timezone(timedelta(hours=8))
# File JS/CSS hasil build disajikan dari /assets.
app = Flask(__name__, static_folder=str(DIST / 'assets'), static_url_path='/assets')
app.config.update(DATABASE=DB_PATH, SECRET_KEY=os.environ.get('SECRET_KEY') or secrets.token_hex(32),
                  SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Strict',
                  MAX_CONTENT_LENGTH=32 * 1024)
STAFF_USERNAME = os.environ.get('STAFF_USERNAME', 'admin')
STAFF_PASSWORD = os.environ.get('STAFF_PASSWORD', 'kantin123')


def now():
    return datetime.now(LOCAL_TZ)


app.teardown_appcontext(close_db)


def init_db():
    """Siapkan tabel SQLite dan menu contoh."""
    init_database(app)


@app.after_request
def headers(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@app.get('/api/papan/siap')
def papan_siap():
    conn = db()
    menunggu = conn.execute(
        "SELECT nomor_antrean,diterima_at,estimasi_menit,estimasi_siap FROM pesanan "
        "WHERE status='menunggu' ORDER BY nomor_antrean"
    ).fetchall()
    diproses = conn.execute(
        "SELECT nomor_antrean,diterima_at,estimasi_menit,estimasi_siap FROM pesanan "
        "WHERE status='diproses' ORDER BY nomor_antrean"
    ).fetchall()
    siap = conn.execute(
        "SELECT nomor_antrean,siap_at FROM pesanan "
        "WHERE status='siap' ORDER BY siap_at,nomor_antrean"
    ).fetchall()
    return jsonify(
        menunggu=[dict(row) for row in menunggu],
        diproses=[dict(row) for row in diproses],
        pesanan=[dict(row) for row in siap],
    )


@app.get('/api/menu')
def menu_public():
    rows = db().execute('SELECT id,nama,harga,tersedia FROM menu WHERE tersedia=1 ORDER BY id').fetchall()
    return jsonify(menu=[dict(row) for row in rows])


@app.get('/api/model')
def info_model():
    try:
        return jsonify(model_info())
    except Exception:
        app.logger.exception('Tidak bisa membaca info model')
        return jsonify(available=False, kind='unavailable')


def serialized_order(row):
    result = {key: row[key] for key in ('id', 'nomor_antrean', 'status', 'diterima_at',
                                        'estimasi_menit', 'estimasi_siap')}
    result['items'] = [dict(r) for r in db().execute(
        'SELECT nama,jumlah,harga FROM detail_pesanan WHERE pesanan_id=? ORDER BY id', (row['id'],))]
    return result


@app.post('/api/pesanan')
def order_create():
    items = json_object().get('items')
    if not isinstance(items, list) or not 1 <= len(items) <= 30:
        return error('Pilih setidaknya satu menu.')
    amounts = {}
    for item in items:
        if not isinstance(item, dict):
            return error('Format item tidak valid.')
        menu_id, qty = item.get('menu_id'), item.get('jumlah')
        if type(menu_id) is not int or type(qty) is not int or menu_id <= 0 or not 1 <= qty <= 100:
            return error('Menu dan jumlah harus valid; jumlah 1 sampai 100.')
        amounts[menu_id] = amounts.get(menu_id, 0) + qty
        if amounts[menu_id] > 100:
            return error('Jumlah setiap menu maksimal 100.')
    conn = db()
    try:
        conn.execute('BEGIN IMMEDIATE')
        selected = []
        for menu_id, qty in amounts.items():
            item = conn.execute('SELECT * FROM menu WHERE id=? AND tersedia=1', (menu_id,)).fetchone()
            if item is None:
                conn.rollback()
                return error('Menu tidak tersedia. Muat ulang daftar menu.')
            selected.append({'menu_id': menu_id, 'nama': item['nama'], 'harga': item['harga'], 'jumlah': qty})
        # One database write transaction orders simultaneous requests and snapshots the queue.
        active = conn.execute("SELECT COUNT(*) FROM pesanan WHERE status IN ('menunggu','diproses')").fetchone()[0]
        number = conn.execute('SELECT COALESCE(MAX(nomor_antrean),0)+1 FROM pesanan').fetchone()[0]
        created = now()
        token = secrets.token_urlsafe(24)
        snapshot = {'items': selected, 'active_ahead': active, 'diterima_at': created.isoformat()}
        cur = conn.execute('INSERT INTO pesanan(nomor_antrean,token,status,diterima_at,snapshot_json) VALUES(?,?,?,?,?)',
                           (number, token, 'menunggu', created.isoformat(), json.dumps(snapshot, ensure_ascii=False)))
        order_id = cur.lastrowid
        conn.executemany('INSERT INTO detail_pesanan(pesanan_id,menu_id,nama,harga,jumlah) VALUES(?,?,?,?,?)',
                         [(order_id, x['menu_id'], x['nama'], x['harga'], x['jumlah']) for x in selected])
        conn.execute('INSERT INTO riwayat_status(pesanan_id,status,waktu) VALUES(?,?,?)',
                     (order_id, 'menunggu', created.isoformat()))
        conn.commit()
    except Exception:
        conn.rollback()
        app.logger.exception('Gagal menyimpan pesanan')
        return error('Pesanan gagal disimpan. Coba lagi.', 500)
    try:
        estimate = predict_minutes(selected, active, created)
        if estimate is not None:
            import math
            estimate = float(estimate)
            if not math.isfinite(estimate) or estimate < 0:
                estimate = None
        estimate = round(estimate, 1) if estimate is not None else None
        ready = (created + timedelta(minutes=estimate)).isoformat() if estimate is not None else None
        info = model_info()
        conn.execute('UPDATE pesanan SET estimasi_menit=?,estimasi_siap=?,model_keterangan=? WHERE id=?',
                     (estimate, ready, json.dumps(info, ensure_ascii=False), order_id))
        conn.commit()
    except Exception:
        conn.rollback()
        estimate, ready = None, None
        app.logger.exception('Estimasi tidak tersedia untuk pesanan %s', order_id)
    return jsonify(nomor_antrean=number, token=token, status='menunggu',
                   estimasi_menit=estimate, estimasi_siap=ready), 201


@app.get('/api/pesanan/<token>')
def order_status(token):
    row = db().execute('SELECT * FROM pesanan WHERE token=?', (token,)).fetchone()
    if row is None:
        return error('Pesanan tidak ditemukan.', 404)
    result = serialized_order(row)
    result.pop('id')
    return jsonify(result)


@app.post('/api/petugas/login')
def login():
    data = json_object()
    username, password = data.get('username', ''), data.get('password', '')
    if not isinstance(username, str) or not isinstance(password, str):
        return error('Kredensial tidak valid.', 401)
    if not (secrets.compare_digest(username.encode(), STAFF_USERNAME.encode()) and
            secrets.compare_digest(password.encode(), STAFF_PASSWORD.encode())):
        return error('Nama pengguna atau kata sandi salah.', 401)
    session.clear()
    session['staff'] = True
    return jsonify(ok=True)


@app.post('/api/petugas/logout')
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get('/api/petugas/pesanan')
@staff_required
def staff_orders():
    rows = db().execute("SELECT * FROM pesanan WHERE status IN ('menunggu','diproses','siap') ORDER BY nomor_antrean").fetchall()
    return jsonify(pesanan=[serialized_order(row) for row in rows])


@app.patch('/api/petugas/pesanan/<int:order_id>/status')
@staff_required
def staff_status(order_id):
    target = json_object().get('status')
    transitions = {'menunggu': {'diproses', 'dibatalkan'}, 'diproses': {'siap', 'dibatalkan'},
                   'siap': {'selesai'}, 'selesai': set(), 'dibatalkan': set()}
    conn = db()
    conn.execute('BEGIN IMMEDIATE')
    row = conn.execute('SELECT * FROM pesanan WHERE id=?', (order_id,)).fetchone()
    if row is None:
        conn.rollback()
        return error('Pesanan tidak ditemukan.', 404)
    if not isinstance(target, str) or target not in transitions.get(row['status'], set()):
        conn.rollback()
        return error('Perubahan status tidak valid.', 409)
    timestamp = now().isoformat()
    conn.execute('UPDATE pesanan SET status=?,siap_at=CASE WHEN ?=\'siap\' THEN ? ELSE siap_at END WHERE id=?',
                 (target, target, timestamp, order_id))
    conn.execute('INSERT INTO riwayat_status(pesanan_id,status,waktu) VALUES(?,?,?)', (order_id,target,timestamp))
    conn.commit()
    return jsonify(ok=True,status=target)


@app.get('/api/petugas/menu')
@staff_required
def staff_menu():
    return jsonify(menu=[dict(row) for row in db().execute('SELECT id,nama,harga,tersedia FROM menu ORDER BY id')])


def validate_menu(data, partial=False):
    allowed = {'nama', 'harga', 'tersedia'}
    if not data or not set(data).issubset(allowed):
        return None
    if not partial and not {'nama', 'harga'}.issubset(data):
        return None
    out = {}
    if 'nama' in data:
        if not isinstance(data['nama'], str) or not 1 <= len(data['nama'].strip()) <= 80:
            return None
        out['nama'] = data['nama'].strip()
    if 'harga' in data:
        if type(data['harga']) is not int or not 0 <= data['harga'] <= 10000000:
            return None
        out['harga'] = data['harga']
    if 'tersedia' in data:
        if type(data['tersedia']) not in (bool, int) or data['tersedia'] not in (0, 1):
            return None
        out['tersedia'] = int(data['tersedia'])
    return out


@app.post('/api/petugas/menu')
@staff_required
def menu_create():
    data = validate_menu(json_object())
    if not data:
        return error('Nama dan harga menu tidak valid.')
    try:
        cur = db().execute('INSERT INTO menu(nama,harga,tersedia) VALUES(?,?,?)',
                           (data['nama'], data['harga'], data.get('tersedia', 1)))
        db().commit()
    except sqlite3.IntegrityError:
        return error('Nama menu sudah ada.', 409)
    return jsonify(ok=True, id=cur.lastrowid), 201


@app.patch('/api/petugas/menu/<int:menu_id>')
@staff_required
def menu_update(menu_id):
    data = validate_menu(json_object(), partial=True)
    if not data:
        return error('Data menu tidak valid.')
    try:
        values = list(data.values()) + [menu_id]
        cur = db().execute('UPDATE menu SET ' + ','.join(k+'=?' for k in data) + ' WHERE id=?', values)
        db().commit()
    except sqlite3.IntegrityError:
        return error('Nama menu sudah ada.', 409)
    if not cur.rowcount:
        return error('Menu tidak ditemukan.', 404)
    return jsonify(ok=True)


@app.get('/favicon.svg')
def favicon():
    return send_from_directory(DIST, 'favicon.svg')


@app.get('/', defaults={'path': ''})
@app.get('/<path:path>')
def frontend(path):
    """Semua alamat halaman (/, /pesanan/<token>, /petugas, /papan) memakai aplikasi React."""
    if path.startswith('api/'):
        return error('Alamat tidak ditemukan.', 404)
    if not (DIST / 'index.html').exists():
        return ('Tampilan belum dibangun. Di folder frontend jalankan: npm install lalu npm run build', 503,
                {'Content-Type': 'text/plain; charset=utf-8'})
    return send_from_directory(DIST, 'index.html')


init_db()

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    print('MVP demonstrasi lokal: http://127.0.0.1:5000')
    app.run(host='127.0.0.1', port=5000, debug=False)
