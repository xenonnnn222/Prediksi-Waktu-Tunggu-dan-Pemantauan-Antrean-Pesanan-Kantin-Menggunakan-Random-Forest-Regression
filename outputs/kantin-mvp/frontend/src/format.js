// Fungsi bantu untuk menampilkan angka, status, dan waktu.
export const currency = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const LABEL_STATUS = {
  menunggu: 'Menunggu',
  diproses: 'Diproses',
  siap: 'Siap diambil',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};
export const label = (status) => LABEL_STATUS[status] || status || 'Menunggu';

export function shortTime(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' }) + ' WITA';
}
