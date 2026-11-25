// Menyimpan riwayat pesanan AKTIF (menunggu/diproses/siap) di perangkat pembeli.
// Begitu pesanan ditandai 'selesai' (diambil) atau 'dibatalkan', otomatis dihapus dari pintasan.

const STORAGE_KEY = 'ujasmine_recent_orders_v1';
const MAX_SAVED = 6;
const CHANGE_EVENT = 'ujasmine:orders-changed';
export const ACTIVE_STATUSES = new Set(['menunggu', 'diproses', 'siap']);

export function isActiveOrderStatus(status) {
  return ACTIVE_STATUSES.has(String(status || '').toLowerCase());
}

export function getSavedOrders() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) return [];
    return list.filter(
      (item) => item && typeof item.token === 'string' && item.token.length > 0 && isActiveOrderStatus(item.status || 'menunggu'),
    );
  } catch (_) {
    return [];
  }
}

function persist(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_SAVED)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch (_) {
    // Abaikan jika penyimpanan browser tidak tersedia.
  }
}

export function saveOrderToHistory(order) {
  if (!order || !order.token) return;
  const status = order.status ?? 'menunggu';
  if (!isActiveOrderStatus(status)) {
    removeSavedOrder(order.token);
    return;
  }
  const current = getSavedOrders();
  const existing = current.find((item) => item.token === order.token) || {};
  const merged = {
    token: order.token,
    nomor_antrean: order.nomor_antrean ?? existing.nomor_antrean ?? null,
    status,
    estimasi_menit: order.estimasi_menit ?? existing.estimasi_menit ?? null,
    diterima_at: order.diterima_at ?? existing.diterima_at ?? new Date().toISOString(),
  };
  const rest = current.filter((item) => item.token !== order.token);
  persist([merged, ...rest]);
}

export function removeSavedOrder(token) {
  const next = getSavedOrders().filter((item) => item.token !== token);
  persist(next);
}

export function removeSavedOrderByNumber(nomorAntrean) {
  if (nomorAntrean === null || nomorAntrean === undefined) return;
  const next = getSavedOrders().filter((item) => Number(item.nomor_antrean) !== Number(nomorAntrean));
  persist(next);
}

export function clearSavedOrders() {
  persist([]);
}

export function subscribeSavedOrders(callback) {
  const onChange = () => callback(getSavedOrders());
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
