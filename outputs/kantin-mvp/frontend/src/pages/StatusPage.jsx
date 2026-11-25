// Halaman status pesanan U'Jasmine: stepper progres animasi, hitung mundur refresh, & estimasi awal.
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  FlaskConical,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api.js';
import { label, shortTime } from '../format.js';
import {
  getSavedOrders,
  removeSavedOrder,
  saveOrderToHistory,
  subscribeSavedOrders,
} from '../orderHistory.js';
import FoodIcon from '../components/FoodIcon.jsx';

const STEPS = [
  { key: 'menunggu', label: 'Menunggu', Icon: ClipboardList },
  { key: 'diproses', label: 'Diproses', Icon: Flame },
  { key: 'siap', label: 'Siap Diambil', Icon: Bell },
  { key: 'selesai', label: 'Selesai', Icon: CheckCircle2 },
];

const STATUS_HERO = {
  menunggu: {
    foodIcon: 'bento-box',
    title: 'Pesananmu sudah tercatat!',
    sub: 'Santai dulu ya, pesananmu sudah masuk urutan antrean di dapur U’Jasmine.',
  },
  diproses: {
    foodIcon: 'pot-of-food',
    title: 'Sedang disiapkan di dapur!',
    sub: 'Petugas sedang mengerjakan pesananmu. Sebentar lagi siap diambil.',
  },
  siap: {
    foodIcon: 'bell',
    title: 'Pesananmu sudah SIAP diambil!',
    sub: 'Tunjukkan nomor antrean di bawah kepada petugas di loket U’Jasmine.',
  },
  selesai: {
    foodIcon: 'party-popper',
    title: 'Pesanan selesai diambil!',
    sub: 'Terima kasih sudah memesan di Kantin U’Jasmine. Selamat menikmati!',
  },
  dibatalkan: {
    foodIcon: 'fork-and-knife-with-plate',
    title: 'Pesanan dibatalkan.',
    sub: 'Jika ada kekeliruan, silakan buat pesanan baru atau hubungi petugas.',
  },
};

export default function StatusPage({ token }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedOrders, setSavedOrders] = useState(() => getSavedOrders());

  async function fetchOrder(showSpin = false) {
    if (showSpin) setRefreshing(true);
    try {
      const data = await api('/api/pesanan/' + encodeURIComponent(token));
      setOrder(data);
      setError('');
      saveOrderToHistory({ ...data, token });
    } catch (err) {
      setError(err.message);
      if (err && err.status === 404) removeSavedOrder(token);
    } finally {
      setSecondsLeft(10);
      if (showSpin) setTimeout(() => setRefreshing(false), 450);
    }
  }

  const isFinished = order && (order.status === 'selesai' || order.status === 'dibatalkan');

  useEffect(() => {
    let active = true;
    const unsub = subscribeSavedOrders(setSavedOrders);
    fetchOrder(false);
    return () => {
      active = false;
      unsub();
    };
  }, [token]);

  useEffect(() => {
    if (isFinished) return;
    let active = true;
    const poll = setInterval(() => {
      if (active) fetchOrder(false);
    }, 10000);
    const tick = setInterval(() => {
      if (active) setSecondsLeft((s) => (s > 1 ? s - 1 : 10));
    }, 1000);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [token, isFinished]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      setCopied(false);
    }
  }

  const hasEstimate = order && order.estimasi_menit !== null && order.estimasi_menit !== undefined;
  const isCancelled = order && order.status === 'dibatalkan';
  const currentIdx = order ? STEPS.findIndex((s) => s.key === order.status) : -1;
  const progressPct = currentIdx >= 0 ? (currentIdx / (STEPS.length - 1)) * 100 : 0;
  const hero = (order && STATUS_HERO[order.status]) || STATUS_HERO.menunggu;

  return (
    <div className="wrap page narrow" data-page="status">
      <div className="status-nav-row">
        <a href="/" className="back">
          <ArrowLeft size={15} strokeWidth={2.6} />
          <span>Pesan menu lagi</span>
        </a>
        <div className="status-actions-top">
          <button type="button" className="mini-action-btn" onClick={copyLink}>
            {copied ? <Check size={14} strokeWidth={2.6} /> : <Copy size={14} strokeWidth={2.2} />}
            <span>{copied ? 'Tautan tersalin' : 'Salin tautan'}</span>
          </button>
          <button
            type="button"
            className="mini-action-btn"
            onClick={() => fetchOrder(true)}
            aria-label="Perbarui status sekarang"
          >
            <RefreshCw size={14} strokeWidth={2.3} className={refreshing ? 'spin-icon is-spinning' : 'spin-icon'} />
            <span>Perbarui</span>
          </button>
        </div>
      </div>

      {savedOrders.length > 1 && (
        <div className="order-switcher" aria-label="Pindah ke pesanan lain di perangkat ini">
          <span className="switcher-label">Pesanan lain:</span>
          {savedOrders.map((ord) => (
            <a
              key={ord.token}
              href={'/pesanan/' + encodeURIComponent(ord.token)}
              className={ord.token === token ? 'switcher-pill is-current' : 'switcher-pill'}
            >
              #{ord.nomor_antrean || '?'} · {label(ord.status || 'menunggu')}
            </a>
          ))}
        </div>
      )}

      <div className={`status-hero status-tone-${order?.status || 'menunggu'}`}>
        <div className="status-hero-icon">
          <FoodIcon name={hero.foodIcon} size={44} />
        </div>
        <div>
          <span className="eyebrow">PANTAU PESANAN U’JASMINE</span>
          <h1 className="page-title">{hero.title}</h1>
          <p>{hero.sub}</p>
        </div>
      </div>

      <div className={`status-card ${order?.status === 'siap' ? 'is-ready-glow' : ''}`}>
        {error && <div className="empty">{error}</div>}
        {!error && !order && <div className="empty">Memuat status pesananmu…</div>}
        {!error && order && (
          <>
            <div className="status-top">
              <div>
                <span className="eyebrow">NOMOR ANTREAN</span>
                <div className="number">#{order.nomor_antrean}</div>
                {order.diterima_at && (
                  <div className="order-meta-time">Diterima pukul {shortTime(order.diterima_at)}</div>
                )}
              </div>
              <span className={`badge badge-${order.status}`}>
                {label(order.status)}
              </span>
            </div>

            {!isCancelled && (
              <div className="stepper" aria-label="Tahap pesanan">
                <div className="stepper-track">
                  <div className="stepper-fill" style={{ width: `${progressPct}%` }}></div>
                </div>
                <div className="stepper-nodes">
                  {STEPS.map((step, idx) => {
                    const done = idx < currentIdx;
                    const active = idx === currentIdx;
                    const StepIcon = step.Icon;
                    return (
                      <div
                        key={step.key}
                        className={`step-node ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}
                      >
                        <span className="step-circle" aria-hidden="true">
                          {done ? <Check size={18} strokeWidth={3} /> : <StepIcon size={18} strokeWidth={2.3} />}
                        </span>
                        <strong>{step.label}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="eta">
              <div className="eta-left">
                <span className="eyebrow">ESTIMASI AWAL (RANDOM FOREST)</span>
                <strong>{hasEstimate ? `± ${order.estimasi_menit} menit` : 'Belum tersedia'}</strong>
                {hasEstimate && order.estimasi_siap && (
                  <small>Perkiraan siap sekitar pukul {shortTime(order.estimasi_siap)}</small>
                )}
              </div>
              <div className="eta-clock" aria-hidden="true">
                <Clock size={34} strokeWidth={2.2} />
              </div>
            </div>

            <div className="items-head">Rincian pesanan</div>
            <div className="items-box">
              {(order.items || []).map((item, index) => (
                <div className="item-line" key={index}>
                  <span>{item.nama}</span>
                  <strong>{item.jumlah} porsi</strong>
                </div>
              ))}
            </div>

            <div className="status-foot">
              {isFinished ? (
                <a href="/" className="button primary">
                  <ArrowLeft size={15} strokeWidth={2.6} />
                  <span>Kembali ke menu U’Jasmine</span>
                </a>
              ) : (
                <span className="live-pill-small">
                  <span className="dot pulse-dot"></span> Update otomatis dalam {secondsLeft} detik
                </span>
              )}
              <a href="/papan" className="text-link">
                <span>Lihat papan publik</span>
                <ExternalLink size={13} strokeWidth={2.4} />
              </a>
            </div>
          </>
        )}
      </div>

      <div className="notice">
        <FlaskConical size={18} strokeWidth={2.3} className="notice-icon" />
        <div>
          <strong>Catatan:</strong> estimasi awal menggunakan model demonstrasi berdata simulasi dan bukan jaminan waktu siap. Tunjukkan nomor pesanan saat mengambil makanan.
        </div>
      </div>
    </div>
  );
}
