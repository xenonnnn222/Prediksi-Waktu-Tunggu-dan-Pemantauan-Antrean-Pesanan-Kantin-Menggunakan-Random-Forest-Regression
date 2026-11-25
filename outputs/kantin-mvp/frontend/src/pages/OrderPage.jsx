// Halaman pembeli U'Jasmine: filter & cari menu secara dinamis, pilih porsi, lalu buat pesanan.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  FlaskConical,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Timer,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { api, post } from '../api.js';
import { currency, label } from '../format.js';
import { getMenuMeta, MENU_CATEGORIES } from '../menuMeta.js';
import {
  clearSavedOrders,
  getSavedOrders,
  saveOrderToHistory,
  subscribeSavedOrders,
} from '../orderHistory.js';
import FoodIcon from '../components/FoodIcon.jsx';

const HERO_STICKERS = [
  { icon: 'curry-rice', label: 'Nasi Campur', cls: 'st-1' },
  { icon: 'steaming-bowl', label: 'Mie Cakalang', cls: 'st-2' },
  { icon: 'banana', label: 'Pisang Goroho', cls: 'st-3' },
  { icon: 'shaved-ice', label: 'Es Segar', cls: 'st-4' },
];

export default function OrderPage() {
  const [menu, setMenu] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [activeCategory, setActiveCategory] = useState('semua');
  const [query, setQuery] = useState('');
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState(() => getSavedOrders());
  const toastTimer = useRef(null);

  useEffect(() => {
    api('/api/menu')
      .then((data) => {
        setMenu((data.menu || []).filter((m) => m.tersedia !== false && m.tersedia !== 0));
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));

    const unsub = subscribeSavedOrders(setRecentOrders);

    return () => {
      unsub();
      clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(text, icon = 'bento-box') {
    setToast({ text, icon });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function updateQty(item, nextQty) {
    const clamped = Math.max(0, Math.min(99, nextQty));
    const prev = quantities[item.id] || 0;
    setQuantities((curr) => ({ ...curr, [item.id]: clamped }));
    if (clamped > prev) {
      showToast(`+1 ${item.nama} ditambahkan`, getMenuMeta(item.nama).icon);
    }
  }

  function clearCart() {
    setQuantities({});
    showToast('Keranjang dikosongkan', 'bento-box');
  }

  const enrichedMenu = useMemo(
    () => menu.map((item) => ({ ...item, meta: getMenuMeta(item.nama) })),
    [menu],
  );

  const categoryCounts = useMemo(() => {
    const counts = { semua: enrichedMenu.length };
    for (const item of enrichedMenu) {
      counts[item.meta.category] = (counts[item.meta.category] || 0) + 1;
    }
    return counts;
  }, [enrichedMenu]);

  const filteredMenu = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrichedMenu.filter((item) => {
      const catOk = activeCategory === 'semua' || item.meta.category === activeCategory;
      const qOk = !q || item.nama.toLowerCase().includes(q) || item.meta.tag.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [enrichedMenu, activeCategory, query]);

  const selected = menu.filter((m) => (quantities[m.id] || 0) > 0);
  const totalPorsi = selected.reduce((sum, m) => sum + (quantities[m.id] || 0), 0);
  const totalHarga = selected.reduce((sum, m) => sum + Number(m.harga) * quantities[m.id], 0);

  async function submitOrder() {
    if (!selected.length) return;
    setSaving(true);
    setMessage('');
    try {
      const items = selected.map((m) => ({ menu_id: m.id, jumlah: quantities[m.id] }));
      const data = await post('/api/pesanan', { items });
      if (!data.token) {
        throw new Error('Pesanan tersimpan tetapi tautan status tidak tersedia. Hubungi petugas.');
      }
      saveOrderToHistory(data);
      window.location.assign('/pesanan/' + encodeURIComponent(data.token));
    } catch (err) {
      setMessage(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="wrap page" data-page="order">
      <section className="hero">
        <div className="hero-copy">
          <div className="sticker-tag">
            <span className="dot pulse-dot"></span> KANTIN U’JASMINE
          </div>
          <h1>
            Pesan di U’Jasmine,<br />
            <span>tunggu tanpa nebak.</span>
          </h1>
          <p>
            Pilih menu favoritmu, langsung dapatkan nomor antrean dan estimasi awal waktu siap, lalu pantau dari mejamu.
          </p>
          <div className="hero-chips">
            <span className="meta-chip">
              <UtensilsCrossed size={14} strokeWidth={2.4} />
              <span>{menu.length || 30} menu tersedia</span>
            </span>
            <span className="meta-chip">
              <Timer size={14} strokeWidth={2.4} />
              <span>Estimasi awal otomatis</span>
            </span>
            <span className="meta-chip">
              <Bell size={14} strokeWidth={2.4} />
              <span>Papan siap real-time</span>
            </span>
          </div>
        </div>

        <div className="hero-stickers" aria-hidden="true">
          {HERO_STICKERS.map((st) => (
            <div className={`food-sticker ${st.cls}`} key={st.label}>
              <FoodIcon name={st.icon} size={46} />
              <span>{st.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="notice">
        <FlaskConical size={18} strokeWidth={2.3} className="notice-icon" />
        <div>
          <strong>Prototipe demonstrasi.</strong> Estimasi awal dihitung oleh model Random Forest dengan data simulasi, sehingga belum mencerminkan akurasi kantin sebenarnya.
        </div>
      </div>

      {recentOrders.length > 0 && (
        <section className="recent-orders-bar" aria-label="Pesanan aktifmu">
          <div className="recent-orders-head">
            <span className="eyebrow">PESANAN AKTIFMU DI PERANGKAT INI</span>
            <button type="button" className="text-btn" onClick={clearSavedOrders}>
              Sembunyikan
            </button>
          </div>
          <div className="recent-orders-list">
            {recentOrders.map((ord) => (
              <a
                key={ord.token}
                href={'/pesanan/' + encodeURIComponent(ord.token)}
                className={`recent-order-chip status-chip-${ord.status || 'menunggu'}`}
              >
                <strong>#{ord.nomor_antrean || '?'}</strong>
                <span className={`badge badge-${ord.status || 'menunggu'}`}>{label(ord.status || 'menunggu')}</span>
                {ord.estimasi_menit !== null && ord.estimasi_menit !== undefined && (
                  <small>±{ord.estimasi_menit} mnt</small>
                )}
                <ArrowRight size={14} strokeWidth={2.5} />
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="order-layout">
        <section aria-labelledby="menu-title">
          <div className="section-title">
            <div>
              <span className="eyebrow">MENU U’JASMINE</span>
              <h2 id="menu-title">Mau makan apa hari ini?</h2>
              <p>Cari cepat atau pilih kategori untuk menemukan hidangan favoritmu.</p>
            </div>
            {totalPorsi > 0 && (
              <span className="cart-pill-inline" key={totalPorsi}>
                <ShoppingBag size={14} strokeWidth={2.5} />
                <span>{totalPorsi} porsi dipilih</span>
              </span>
            )}
          </div>

          <div className="filter-bar">
            <div className="search-box">
              <Search size={17} strokeWidth={2.3} className="search-ico" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nasi goreng, cakalang, pisang goroho, es kacang…"
                aria-label="Cari menu"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Hapus pencarian"
                >
                  <X size={13} strokeWidth={2.8} />
                </button>
              )}
            </div>

            <div className="category-pills" role="tablist" aria-label="Filter kategori menu">
              {MENU_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={active ? 'cat-pill is-active' : 'cat-pill'}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <FoodIcon name={cat.icon} size={19} />
                    <span>{cat.label}</span>
                    <small>{count}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="menu-list">
            {loading && (
              <div className="skeleton-grid" aria-label="Memuat menu">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div className="skeleton-card" key={n}></div>
                ))}
              </div>
            )}
            {loadError && <div className="empty">{loadError}</div>}
            {!loading && !loadError && !filteredMenu.length && (
              <div className="empty">
                <div className="empty-icon-wrap">
                  <FoodIcon name="fork-and-knife-with-plate" size={44} />
                </div>
                <strong>Menu tidak ditemukan.</strong>
                <p className="muted">Coba kata kunci lain atau tampilkan semua menu.</p>
                {(query || activeCategory !== 'semua') && (
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => {
                      setQuery('');
                      setActiveCategory('semua');
                    }}
                  >
                    Tampilkan semua menu
                  </button>
                )}
              </div>
            )}

            {filteredMenu.map((item, idx) => {
              const qty = quantities[item.id] || 0;
              return (
                <article
                  className={`menu-item ${qty > 0 ? 'is-selected' : ''}`}
                  key={item.id}
                  style={{ '--stagger': `${Math.min(idx, 12) * 28}ms` }}
                >
                  <div className={`menu-icon tone-${item.meta.tone}`}>
                    <FoodIcon name={item.meta.icon} size={36} />
                  </div>
                  <div className="menu-details">
                    <div className="menu-top-line">
                      <h3>{item.nama}</h3>
                      <span className={`mini-tag tone-${item.meta.tone}`}>{item.meta.tag}</span>
                    </div>
                    <p className="menu-price">{currency(item.harga)}</p>
                  </div>

                  {qty === 0 ? (
                    <button
                      type="button"
                      className="add-btn"
                      onClick={() => updateQty(item, 1)}
                      aria-label={`Tambah ${item.nama}`}
                    >
                      <Plus size={15} strokeWidth={2.8} />
                      <span>Tambah</span>
                    </button>
                  ) : (
                    <div className="counter">
                      <button
                        type="button"
                        aria-label={`Kurangi ${item.nama}`}
                        onClick={() => updateQty(item, qty - 1)}
                      >
                        <Minus size={14} strokeWidth={2.8} />
                      </button>
                      <span className="qty-value" key={`${item.id}-${qty}`}>{qty}</span>
                      <button
                        type="button"
                        aria-label={`Tambah ${item.nama}`}
                        onClick={() => updateQty(item, qty + 1)}
                      >
                        <Plus size={14} strokeWidth={2.8} />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="summary">
          <div className="summary-head">
            <div>
              <span className="eyebrow">PESANANMU</span>
              <h2>Ringkasan</h2>
            </div>
            {selected.length > 0 && (
              <button type="button" className="text-btn" onClick={clearCart}>
                <Trash2 size={13} strokeWidth={2.4} />
                <span>Kosongkan</span>
              </button>
            )}
          </div>

          <div className="cart-items">
            {!selected.length && (
              <div className="cart-empty">
                <FoodIcon name="bento-box" size={40} />
                <p className="muted">Belum ada menu dipilih. Klik <strong>Tambah</strong> pada menu di samping.</p>
              </div>
            )}
            {selected.map((m) => (
              <div className="cart-row" key={m.id}>
                <span>
                  <em className="cart-qty-badge">{quantities[m.id]}×</em> {m.nama}
                </span>
                <strong>{currency(Number(m.harga) * quantities[m.id])}</strong>
              </div>
            ))}
          </div>

          <div className="summary-total">
            <div>
              <span>Total bayar</span>
              {totalPorsi > 0 && <small>{totalPorsi} porsi · {selected.length} jenis</small>}
            </div>
            <strong key={totalHarga} className="total-pop">{currency(totalHarga)}</strong>
          </div>

          <button
            className="button primary full"
            disabled={!selected.length || saving}
            onClick={submitOrder}
          >
            <span>{saving ? 'Menyimpan & menghitung…' : 'Buat pesanan sekarang'}</span>
            <ArrowRight size={17} strokeWidth={2.6} className="btn-arrow" />
          </button>
          <p className="fine">Nomor antrean & estimasi awal langsung tampil setelah dikirim.</p>
          <div className="message" role="alert" aria-live="polite">{message}</div>
        </aside>
      </div>

      {toast && (
        <div className="toast-pill" role="status" aria-live="polite">
          <FoodIcon name={toast.icon} size={20} />
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
