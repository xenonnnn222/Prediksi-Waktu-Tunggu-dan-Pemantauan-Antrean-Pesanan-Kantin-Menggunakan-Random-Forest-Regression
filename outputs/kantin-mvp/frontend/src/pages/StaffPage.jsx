// Panel petugas U'Jasmine: ringkasan KPI, filter antrean, auto-update, & kelola menu.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  ChefHat,
  ClipboardList,
  Clock,
  Edit3,
  Flame,
  Info,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Timer,
} from 'lucide-react';
import { api, patch, post } from '../api.js';
import { currency, label, shortTime } from '../format.js';
import { removeSavedOrderByNumber } from '../orderHistory.js';
import FoodIcon from '../components/FoodIcon.jsx';

const NEXT_STEP = {
  menunggu: { status: 'diproses', text: 'Mulai proses', Icon: Flame },
  diproses: { status: 'siap', text: 'Tandai siap', Icon: Bell },
  siap: { status: 'selesai', text: 'Tandai selesai', Icon: Check },
};

export default function StaffPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [statusFilter, setStatusFilter] = useState('semua');
  const [menuQuery, setMenuQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [menuMessage, setMenuMessage] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [toast, setToast] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [newMenu, setNewMenu] = useState({ nama: '', harga: '' });
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef(null);

  function showToast(text) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  function handleSessionError(err) {
    if (err.status === 401 || err.status === 403) {
      setSignedIn(false);
      return true;
    }
    return false;
  }

  async function loadQueue(showSpin = false) {
    if (showSpin) setRefreshing(true);
    setMessage('');
    try {
      const data = await api('/api/petugas/pesanan');
      setSignedIn(true);
      setOrders((data.pesanan || []).filter((o) => !['selesai', 'dibatalkan'].includes(o.status)));
    } catch (err) {
      if (!handleSessionError(err)) setMessage(err.message);
    } finally {
      if (showSpin) setTimeout(() => setRefreshing(false), 450);
    }
  }

  async function loadMenu() {
    setMenuMessage('');
    try {
      const data = await api('/api/petugas/menu');
      setMenu(data.menu || []);
    } catch (err) {
      if (!handleSessionError(err)) setMenuMessage(err.message);
    }
  }

  useEffect(() => {
    loadQueue(false);
    return () => clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (signedIn) loadMenu();
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !autoRefresh) return;
    const timer = setInterval(() => loadQueue(false), 10000);
    return () => clearInterval(timer);
  }, [signedIn, autoRefresh]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginMessage('');
    setBusy(true);
    try {
      await post('/api/petugas/login', loginForm);
      setLoginForm({ username: '', password: '' });
      await loadQueue(false);
      showToast('Berhasil masuk ke panel petugas U’Jasmine');
    } catch (err) {
      setLoginMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await post('/api/petugas/logout', {});
      setSignedIn(false);
      setOrders([]);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function changeStatus(order, status) {
    try {
      await patch('/api/petugas/pesanan/' + encodeURIComponent(order.id) + '/status', { status });
      if (status === 'selesai' || status === 'dibatalkan') {
        removeSavedOrderByNumber(order.nomor_antrean);
      }
      await loadQueue(false);
      showToast(`Pesanan #${order.nomor_antrean} diubah ke ${label(status)}`);
    } catch (err) {
      if (!handleSessionError(err)) setMessage(err.message);
    }
  }

  function cancelOrder(order) {
    if (window.confirm(`Batalkan pesanan #${order.nomor_antrean}?`)) {
      changeStatus(order, 'dibatalkan');
    }
  }

  async function toggleMenu(item) {
    try {
      await patch('/api/petugas/menu/' + encodeURIComponent(item.id), { tersedia: !item.tersedia });
      await loadMenu();
      showToast(`${item.nama}: ${!item.tersedia ? 'Aktif' : 'Nonaktif'}`);
    } catch (err) {
      if (!handleSessionError(err)) setMenuMessage(err.message);
    }
  }

  async function editMenu(item) {
    const nama = window.prompt('Nama menu:', item.nama);
    if (nama === null) return;
    const raw = window.prompt('Harga dalam rupiah:', String(item.harga));
    if (raw === null) return;
    const harga = Number(raw);
    if (!nama.trim() || raw.trim() === '' || !Number.isInteger(harga) || harga < 0) {
      setMenuMessage('Nama dan harga harus valid.');
      return;
    }
    try {
      await patch('/api/petugas/menu/' + encodeURIComponent(item.id), { nama: nama.trim(), harga });
      await loadMenu();
      showToast(`${nama.trim()} diperbarui`);
    } catch (err) {
      if (!handleSessionError(err)) setMenuMessage(err.message);
    }
  }

  async function addMenu(event) {
    event.preventDefault();
    setMenuMessage('');
    setBusy(true);
    try {
      await post('/api/petugas/menu', { nama: newMenu.nama.trim(), harga: Number(newMenu.harga) });
      const addedName = newMenu.nama.trim();
      setNewMenu({ nama: '', harga: '' });
      await loadMenu();
      showToast(`Menu "${addedName}" ditambahkan`);
    } catch (err) {
      if (!handleSessionError(err)) setMenuMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => ({
    semua: orders.length,
    menunggu: orders.filter((o) => o.status === 'menunggu').length,
    diproses: orders.filter((o) => o.status === 'diproses').length,
    siap: orders.filter((o) => o.status === 'siap').length,
  }), [orders]);

  const visibleOrders = useMemo(
    () => (statusFilter === 'semua' ? orders : orders.filter((o) => o.status === statusFilter)),
    [orders, statusFilter],
  );

  const visibleMenu = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    return q ? menu.filter((m) => m.nama.toLowerCase().includes(q)) : menu;
  }, [menu, menuQuery]);

  const kpiCards = [
    { id: 'semua', Icon: ClipboardList, title: 'Total Aktif', count: counts.semua, tone: 'apricot' },
    { id: 'menunggu', Icon: Clock, title: 'Menunggu', count: counts.menunggu, tone: 'butter' },
    { id: 'diproses', Icon: Flame, title: 'Diproses', count: counts.diproses, tone: 'tangerine' },
    { id: 'siap', Icon: Bell, title: 'Siap Diambil', count: counts.siap, tone: 'mint' },
  ];

  return (
    <div className="wrap page" data-page="staff">
      <div className="staff-heading">
        <div>
          <span className="eyebrow"><span className="dot pulse-dot"></span> RUANG PETUGAS U’JASMINE</span>
          <h1 className="page-title">Antrean dapur hari ini.</h1>
          <p>Pantau pesanan masuk, perbarui status tiap tahap, dan kelola ketersediaan menu.</p>
        </div>
        {signedIn && (
          <div className="staff-top-btns">
            <button
              type="button"
              className={`button ghost ${autoRefresh ? 'is-live-on' : ''}`}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              {autoRefresh ? <PlayCircle size={15} strokeWidth={2.3} /> : <PauseCircle size={15} strokeWidth={2.3} />}
              <span>{autoRefresh ? 'Auto-update 10 dtk' : 'Auto-update mati'}</span>
            </button>
            <button className="button ghost" onClick={handleLogout}>
              <LogOut size={15} strokeWidth={2.3} />
              <span>Keluar</span>
            </button>
          </div>
        )}
      </div>

      {!signedIn && (
        <section className="login-card">
          <div className="login-badge">
            <ChefHat size={28} strokeWidth={2.2} />
          </div>
          <span className="eyebrow">AKSES PETUGAS</span>
          <h2>Masuk ke panel dapur</h2>
          <p className="muted">Gunakan akun petugas demonstrasi lokal untuk mengelola antrean U’Jasmine.</p>
          <form onSubmit={handleLogin}>
            <label>
              Nama pengguna
              <input
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                autoComplete="username"
                placeholder="admin"
                required
              />
            </label>
            <label>
              Kata sandi
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </label>
            <button type="submit" className="button primary full" disabled={busy}>
              <span>{busy ? 'Memeriksa akun…' : 'Masuk ke panel petugas'}</span>
              <ArrowRight size={16} strokeWidth={2.6} />
            </button>
            <div className="message" role="alert">{loginMessage}</div>
          </form>
        </section>
      )}

      {signedIn && (
        <section>
          <div className="kpi-grid">
            {kpiCards.map((k) => {
              const KpiIcon = k.Icon;
              return (
                <button
                  key={k.id}
                  type="button"
                  className={`kpi-card tone-${k.tone} ${statusFilter === k.id ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter(k.id)}
                >
                  <span className="kpi-icon-box">
                    <KpiIcon size={20} strokeWidth={2.4} />
                  </span>
                  <div>
                    <small>{k.title}</small>
                    <strong>{k.count}</strong>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="notice">
            <Info size={18} strokeWidth={2.3} className="notice-icon" />
            <div>
              <strong>Pengingat:</strong> Menekan <strong>Tandai siap</strong> otomatis memunculkan nomor pada papan publik sekaligus mencatat <code>siap_at</code> di database SQLite.
            </div>
          </div>

          <div className="staff-toolbar">
            <div>
              <span className="eyebrow">DAFTAR PESANAN</span>
              <h2>Antrean aktif {statusFilter !== 'semua' ? `· ${label(statusFilter)}` : ''}</h2>
            </div>
            <button className="button ghost" onClick={() => loadQueue(true)}>
              <RefreshCw size={15} strokeWidth={2.3} className={refreshing ? 'spin-icon is-spinning' : 'spin-icon'} />
              <span>Perbarui</span>
            </button>
          </div>
          <div className="message" role="alert">{message}</div>

          <div className="queue-list">
            {!visibleOrders.length && (
              <div className="empty">
                <div className="empty-icon-wrap">
                  <FoodIcon name="hot-beverage" size={44} />
                </div>
                <strong>Belum ada pesanan di kategori ini.</strong>
                <p className="muted">Pesanan baru dari halaman pembeli akan muncul otomatis di sini.</p>
              </div>
            )}
            {visibleOrders.map((order) => {
              const next = NEXT_STEP[order.status];
              const NextIcon = next?.Icon;
              const canCancel = order.status === 'menunggu' || order.status === 'diproses';
              return (
                <article className={`queue-card status-border-${order.status}`} key={order.id}>
                  <div className="queue-id-col">
                    <div className="queue-number">#{order.nomor_antrean}</div>
                    <div className="queue-time">
                      {order.diterima_at ? `Masuk ${shortTime(order.diterima_at)}` : ''}
                    </div>
                    {order.estimasi_menit !== null && order.estimasi_menit !== undefined && (
                      <div className="queue-eta-tag">
                        <Timer size={12} strokeWidth={2.5} />
                        <span>Est. ±{order.estimasi_menit} mnt</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className={`badge badge-${order.status}`}>{label(order.status)}</span>
                    <p className="queue-items">
                      {(order.items || []).map((i) => `${i.jumlah} × ${i.nama}`).join(' · ')}
                    </p>
                  </div>
                  <div className="queue-actions">
                    {next && (
                      <button className="button primary" onClick={() => changeStatus(order, next.status)}>
                        {NextIcon && <NextIcon size={15} strokeWidth={2.5} />}
                        <span>{next.text}</span>
                      </button>
                    )}
                    {canCancel && (
                      <button className="button ghost cancel-btn" onClick={() => cancelOrder(order)}>
                        Batalkan
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <section className="menu-admin">
            <div className="staff-toolbar">
              <div>
                <span className="eyebrow">DAFTAR MENU ({menu.length})</span>
                <h2>Kelola menu U’Jasmine</h2>
              </div>
              <div className="search-box compact-search">
                <Search size={16} strokeWidth={2.3} className="search-ico" />
                <input
                  type="search"
                  value={menuQuery}
                  onChange={(e) => setMenuQuery(e.target.value)}
                  placeholder="Cari menu…"
                  aria-label="Cari menu petugas"
                />
              </div>
            </div>
            <form className="menu-form" onSubmit={addMenu}>
              <label>
                Nama menu
                <input
                  maxLength={100}
                  required
                  placeholder="Contoh: Nasi Goreng Spesial"
                  value={newMenu.nama}
                  onChange={(e) => setNewMenu({ ...newMenu, nama: e.target.value })}
                />
              </label>
              <label>
                Harga (Rp)
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  placeholder="15000"
                  value={newMenu.harga}
                  onChange={(e) => setNewMenu({ ...newMenu, harga: e.target.value })}
                />
              </label>
              <button className="button primary" type="submit" disabled={busy}>
                <Plus size={15} strokeWidth={2.7} />
                <span>Tambah menu</span>
              </button>
            </form>
            <div className="message" role="alert">{menuMessage}</div>
            <div className="admin-menu-list">
              {!visibleMenu.length && <div className="empty">Belum ada menu yang cocok.</div>}
              {visibleMenu.map((item) => (
                <div className={`admin-menu-row ${!item.tersedia ? 'is-off' : ''}`} key={item.id}>
                  <div>
                    <strong>{item.nama}</strong>
                    <small>
                      <span className={`avail-dot ${item.tersedia ? 'is-on' : 'is-off'}`}></span>
                      {`${currency(item.harga)} · ${item.tersedia ? 'Tersedia' : 'Tidak tersedia'}`}
                    </small>
                  </div>
                  <div className="queue-actions">
                    <button className="button ghost" onClick={() => editMenu(item)}>
                      <Edit3 size={14} strokeWidth={2.3} />
                      <span>Ubah</span>
                    </button>
                    <button className="button ghost" onClick={() => toggleMenu(item)}>
                      {item.tersedia ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}

      {toast && (
        <div className="toast-pill" role="status" aria-live="polite">
          <Check size={16} strokeWidth={2.8} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
