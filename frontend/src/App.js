import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MasterDataKaryawan from './pages/MasterDataKaryawan';
import Absensi from './pages/Absensi';
import Monitoring from './pages/Monitoring';
import Gaji from './pages/Gaji';
import Laporan from './pages/Laporan';
import Dashboard from './pages/Dashboard'; // PERUBAHAN: Import komponen Dashboard dari file terpisah
import './App.css';
import './components/Sidebar.css';

// --- HAPUS DEFINISI KOMPONEN Dashboard dan ComingSoon dari sini ---
// Definisi komponen Dashboard dan ComingSoon sekarang ada di file Dashboard.js (atau file terpisah lain)
// Jika ComingSoon masih digunakan untuk rute lain yang belum Anda buat halamannya, Anda bisa memindahkannya ke file terpisah juga, atau tetap biarkan di sini jika hanya digunakan di App.js dan tidak memiliki logika kompleks.
// Untuk saat ini, kita akan asumsikan ComingSoon sudah tidak didefinisikan lagi di App.js jika semua rute sudah punya komponen.
// Jika Anda masih punya rute seperti /laporan yang mengarah ke ComingSoon, Anda perlu membiarkan definisi ComingSoon di sini.
// Karena kita sudah punya Laporan.js, maka ComingSoon hanya perlu jika ada menu lain yang belum dibuat.
// Jika tidak ada menu lain yang ComingSoon, Anda bisa menghapus definisi ComingSoon ini juga.

// Karena kita sudah punya Dashboard.js dan Laporan.js, dan tidak ada lagi rute placeholder,
// kita bisa hapus definisi ComingSoon jika tidak digunakan.
/*
const ComingSoon = ({ pageTitle }) => (
  <div className="coming-soon-content">
    <h1>{pageTitle}</h1>
    <p>Halaman ini sedang dalam pengembangan. Mohon bersabar!</p>
    <a href="/">Kembali ke Dashboard</a>
  </div>
);
*/

function App() {
  return (
    <Router>
      <div className="App">
        <Sidebar />
        <div className="content">
          <Routes>
            {/* Rute untuk Dashboard */}
            <Route path="/" element={<Dashboard />} /> {/* PERUBAHAN: Menggunakan komponen Dashboard yang diimpor */}

            {/* Rute untuk Master Data */}
            <Route path="/master-data" element={<MasterDataKaryawan />} />

            {/* Rute untuk Absensi */}
            <Route path="/absensi" element={<Absensi />} />

            {/* Rute untuk Monitoring */}
            <Route path="/monitoring" element={<Monitoring />} />

            {/* Rute untuk Gaji */}
            <Route path="/gaji" element={<Gaji />} />

            {/* Rute untuk Laporan */}
            <Route path="/laporan" element={<Laporan />} />

            {/* Rute fallback jika halaman tidak ditemukan */}
            <Route path="*" element={<h2>404: Halaman Tidak Ditemukan</h2>} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;