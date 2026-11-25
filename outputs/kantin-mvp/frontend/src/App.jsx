// Memilih halaman berdasarkan alamat di browser.
// Tidak memakai pustaka router agar mudah dipelajari.
import Layout from './components/Layout.jsx';
import OrderPage from './pages/OrderPage.jsx';
import StatusPage from './pages/StatusPage.jsx';
import StaffPage from './pages/StaffPage.jsx';
import BoardPage from './pages/BoardPage.jsx';

function App() {
  const path = window.location.pathname;
  const statusMatch = path.match(/^\/pesanan\/([^/]+)$/);

  let page;
  if (statusMatch) {
    page = <StatusPage token={decodeURIComponent(statusMatch[1])} />;
  } else if (path === '/petugas') {
    page = <StaffPage />;
  } else if (path === '/papan') {
    page = <BoardPage />;
  } else {
    page = <OrderPage />;
  }

  return <Layout>{page}</Layout>;
}

export default App;
