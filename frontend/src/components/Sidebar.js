import React from 'react';
import { Link } from 'react-router-dom'; // Pastikan Link diimpor
import './Sidebar.css';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Amanah</h2>
        <p className="slogan">Manajemen Karyawan</p>
      </div>
      <ul className="sidebar-menu">
        <li className="menu-item">
          <Link to="/">Dashboard</Link>
        </li>
        <li className="menu-item">
          <Link to="/master-data">Master Data</Link>
        </li>
        <li className="menu-item">
          <Link to="/absensi">Absensi</Link>
        </li>
        <li className="menu-item">
          <Link to="/monitoring">Monitoring</Link>
        </li>
        <li className="menu-item">
          <Link to="/gaji">Gaji</Link>
        </li>
        <li className="menu-item">
          <Link to="/laporan">Laporan</Link>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;