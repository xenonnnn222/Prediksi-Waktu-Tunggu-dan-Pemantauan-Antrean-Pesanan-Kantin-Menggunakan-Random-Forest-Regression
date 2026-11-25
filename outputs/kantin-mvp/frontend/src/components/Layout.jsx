// Kerangka halaman U'Jasmine: header dengan pintasan kembali ke status pesanan, isi halaman, dan footer.
import { useEffect, useState } from 'react';
import { Bell, ChefHat, FlaskConical, ReceiptText, UtensilsCrossed } from 'lucide-react';
import FoodIcon from './FoodIcon.jsx';
import { getSavedOrders, subscribeSavedOrders } from '../orderHistory.js';

export default function Layout({ children }) {
  const [savedOrders, setSavedOrders] = useState(() => getSavedOrders());

  useEffect(() => subscribeSavedOrders(setSavedOrders), []);

  const path = window.location.pathname;
  const isOrder = path === '/';
  const isStatus = path.startsWith('/pesanan/');
  const isBoard = path === '/papan';
  const isStaff = path === '/petugas';

  // Prioritaskan pesanan yang masih aktif (menunggu/diproses/siap) untuk pintasan header.
  const primaryOrder =
    savedOrders.find((o) => ['menunggu', 'diproses', 'siap'].includes(o.status)) || savedOrders[0];
  const primaryActive = primaryOrder && ['menunggu', 'diproses', 'siap'].includes(primaryOrder.status);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="wrap nav">
          <a className="brand" href="/" aria-label="U'Jasmine beranda">
            <span className="brand-mark">
              <FoodIcon name="bento-box" size={26} />
            </span>
            <span>
              U’Jasmine
              <small>Kantin Kampus · Pesan & pantau antrean</small>
            </span>
          </a>

          <nav aria-label="Navigasi utama">
            <a href="/" className={isOrder ? 'nav-pill is-active' : 'nav-pill'}>
              <UtensilsCrossed size={15} strokeWidth={2.3} />
              <span>Pesan menu</span>
            </a>

            {primaryOrder && (
              <a
                href={'/pesanan/' + encodeURIComponent(primaryOrder.token)}
                className={isStatus ? 'nav-pill nav-my-order is-active' : 'nav-pill nav-my-order'}
              >
                {primaryActive ? (
                  <span className="dot pulse-dot"></span>
                ) : (
                  <ReceiptText size={15} strokeWidth={2.3} />
                )}
                <span>
                  Pesanan saya{primaryOrder.nomor_antrean ? ` (#${primaryOrder.nomor_antrean})` : ''}
                </span>
              </a>
            )}

            <a href="/papan" className={isBoard ? 'nav-pill is-active' : 'nav-pill'}>
              <Bell size={15} strokeWidth={2.3} />
              <span>Pesanan siap</span>
            </a>
            <a href="/petugas" className={isStaff ? 'nav-pill nav-staff is-active' : 'nav-pill nav-staff'}>
              <ChefHat size={15} strokeWidth={2.3} />
              <span>Panel petugas</span>
            </a>
          </nav>
        </div>
      </header>

      <main className="main-stage">{children}</main>

      <footer className="wrap footer">
        <span>
          <strong>Kantin U’Jasmine</strong> · Prototipe sistem antrean & estimasi waktu
        </span>
        <span className="footer-chip">
          <FlaskConical size={13} strokeWidth={2.3} />
          <span>Estimasi model demonstrasi dilatih dengan data simulasi</span>
        </span>
      </footer>
    </div>
  );
}
