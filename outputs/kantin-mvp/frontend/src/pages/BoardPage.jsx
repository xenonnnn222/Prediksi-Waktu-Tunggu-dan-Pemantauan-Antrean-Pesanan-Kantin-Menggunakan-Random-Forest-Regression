// Papan publik U'Jasmine: menampilkan semua pesanan aktif (Menunggu, Sedang Diproses, Siap Diambil).
import { useEffect, useState } from 'react';
import { Clock, Flame, Hourglass } from 'lucide-react';
import { api } from '../api.js';
import { shortTime } from '../format.js';
import FoodIcon from '../components/FoodIcon.jsx';

function formatClock(date) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export default function BoardPage() {
  const [waitOrders, setWaitOrders] = useState([]);
  const [prepOrders, setPrepOrders] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [status, setStatus] = useState('Memuat papan antrean…');
  const [isError, setIsError] = useState(false);
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const tick = setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let active = true;
    let timer;

    async function refresh() {
      try {
        const data = await api('/api/papan/siap');
        if (!Array.isArray(data.pesanan)) throw new Error('Data papan tidak tersedia.');
        if (!active) return;
        const menunggu = Array.isArray(data.menunggu) ? data.menunggu : [];
        const diproses = Array.isArray(data.diproses) ? data.diproses : [];
        const siap = data.pesanan;
        setWaitOrders(menunggu);
        setPrepOrders(diproses);
        setReadyOrders(siap);
        const totalAktif = menunggu.length + diproses.length + siap.length;
        setStatus(
          totalAktif
            ? `${totalAktif} pesanan aktif: ${menunggu.length} menunggu · ${diproses.length} diproses · ${siap.length} siap diambil.`
            : 'Belum ada pesanan aktif saat ini.',
        );
        setIsError(false);
      } catch (_) {
        if (!active) return;
        setWaitOrders([]);
        setPrepOrders([]);
        setReadyOrders([]);
        setStatus('Papan tidak dapat diperbarui. Memeriksa koneksi kembali…');
        setIsError(true);
      } finally {
        if (active) timer = setTimeout(refresh, 10000);
      }
    }

    refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="wrap page board-page" data-page="board">
      <div className="board-heading">
        <div>
          <div className="sticker-tag sticker-mint">
            <span className="dot pulse-dot"></span> PAPAN ANTREAN PUBLIK · U’JASMINE
          </div>
          <h1>
            Semua pesanan aktif,<br />
            <span>pantau langsung!</span>
          </h1>
          <p>
            Pantau urutan antrean menunggu, pesanan yang sedang dimasak di dapur, hingga nomor yang siap diambil.
          </p>
        </div>
        <div className="board-meta-right">
          <div className="board-clock" aria-label="Jam saat ini">
            <Clock size={20} strokeWidth={2.5} />
            <span>{clock}</span>
          </div>
          <div className="board-live">
            <span className="dot pulse-dot"></span> LIVE · Diperbarui tiap 10 detik
          </div>
        </div>
      </div>

      <div
        className={'board-status-banner' + (isError ? ' board-error' : '')}
        role="status"
        aria-live="polite"
      >
        {status}
      </div>

      <div className="board-split board-split-3">
        {/* KOLOM 1: MENUNGGU */}
        <section className="board-panel board-panel-wait" aria-labelledby="wait-title">
          <div className="board-panel-heading">
            <div>
              <span className="eyebrow eyebrow-wait">ANTREAN MASUK ({waitOrders.length})</span>
              <h2 id="wait-title">Menunggu</h2>
            </div>
            <span className="board-stamp board-stamp-wait">
              <FoodIcon name="bento-box" size={30} />
            </span>
          </div>

          {!waitOrders.length ? (
            <div className="board-empty-fun">
              <div className="board-empty-icon">
                <FoodIcon name="bento-box" size={44} />
              </div>
              <strong>Antrean kosong</strong>
              <p className="muted">Pesanan yang baru masuk akan tampil di sini.</p>
            </div>
          ) : (
            <div className="board-list board-list-compact" aria-label="Daftar nomor menunggu">
              {waitOrders.map((order, idx) => (
                <div
                  className="board-number board-number-wait"
                  key={order.nomor_antrean}
                  style={{ '--stagger': `${idx * 55}ms` }}
                >
                  <span className="board-number-label label-wait">
                    <Hourglass size={11} strokeWidth={2.6} /> MENUNGGU
                  </span>
                  <strong>#{order.nomor_antrean}</strong>
                  {order.estimasi_menit !== null && order.estimasi_menit !== undefined && (
                    <small className="board-wait-time">Est. ±{order.estimasi_menit} mnt</small>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* KOLOM 2: SEDANG DIPROSES */}
        <section className="board-panel board-panel-prep" aria-labelledby="prep-title">
          <div className="board-panel-heading">
            <div>
              <span className="eyebrow">DI DAPUR ({prepOrders.length})</span>
              <h2 id="prep-title">Sedang diproses</h2>
            </div>
            <span className="board-stamp board-stamp-prep">
              <FoodIcon name="pot-of-food" size={30} />
            </span>
          </div>

          {!prepOrders.length ? (
            <div className="board-empty-fun">
              <div className="board-empty-icon">
                <FoodIcon name="pot-of-food" size={44} />
              </div>
              <strong>Belum ada yang dimasak</strong>
              <p className="muted">Nomor muncul di sini saat petugas mulai memproses.</p>
            </div>
          ) : (
            <div className="board-list board-list-compact" aria-label="Daftar nomor sedang diproses">
              {prepOrders.map((order, idx) => (
                <div
                  className="board-number board-number-prep"
                  key={order.nomor_antrean}
                  style={{ '--stagger': `${idx * 55}ms` }}
                >
                  <span className="board-number-label label-prep">
                    <Flame size={11} strokeWidth={2.6} /> DIPROSES
                  </span>
                  <strong>#{order.nomor_antrean}</strong>
                  {order.estimasi_menit !== null && order.estimasi_menit !== undefined && (
                    <small className="board-prep-time">Est. ±{order.estimasi_menit} mnt</small>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* KOLOM 3: SIAP DIAMBIL */}
        <section className="board-panel board-panel-ready" aria-labelledby="ready-title">
          <div className="board-panel-heading">
            <div>
              <span className="eyebrow eyebrow-mint">LOKET AMBIL ({readyOrders.length})</span>
              <h2 id="ready-title">Siap diambil</h2>
            </div>
            <span className={`board-stamp ${readyOrders.length ? 'is-ringing' : ''}`}>
              <FoodIcon name="bell" size={30} />
            </span>
          </div>

          {!readyOrders.length ? (
            <div className="board-empty-fun">
              <div className="board-empty-icon">
                <FoodIcon name="bell" size={44} />
              </div>
              <strong>Belum ada yang siap</strong>
              <p className="muted">Begitu ditandai siap, nomor langsung tampil di sini.</p>
            </div>
          ) : (
            <div className="board-list board-list-compact" aria-label="Daftar nomor siap diambil">
              {readyOrders.map((order, idx) => (
                <div
                  className="board-number"
                  key={order.nomor_antrean}
                  style={{ '--stagger': `${idx * 55}ms` }}
                >
                  <span className="board-number-label">SIAP DIAMBIL</span>
                  <strong>#{order.nomor_antrean}</strong>
                  {order.siap_at && (
                    <small className="board-ready-time">Siap {shortTime(order.siap_at)}</small>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <p className="board-footnote">
        Papan hanya menampilkan nomor antrean dan estimasi ringkas tanpa informasi pribadi. Nomor otomatis hilang setelah pesanan ditandai selesai.
      </p>
    </div>
  );
}
