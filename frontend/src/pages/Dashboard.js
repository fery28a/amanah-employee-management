import React, { useState, useEffect } from 'react';
import axios from 'axios';
// --- Import komponen Recharts ---
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const API_BASE_URL = 'http://10.10.10.100:5001/api';

// Fungsi helper untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD
const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const Dashboard = () => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // Bulan 1-12
  const currentYear = today.getFullYear();

  const [karyawanList, setKaryawanList] = useState([]);

  // State untuk menyimpan data kinerja (total pekerjaan selesai per karyawan)
  const [employeePerformance, setEmployeePerformance] = useState([]);

  // State untuk ringkasan kehadiran hari ini
  const [totalHadirToday, setTotalHadirToday] = useState(0);
  const [totalAbsenToday, setTotalAbsenToday] = useState(0);
  const [totalPulangToday, setTotalPulangToday] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Ambil Daftar Karyawan dari Backend ---
  useEffect(() => {
    const fetchEmployees = async () => {
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/employees`);
        setKaryawanList(response.data);
      } catch (err) {
        console.error('Error fetching employees for dashboard:', err);
        setError('Gagal memuat daftar karyawan.');
      }
    };
    fetchEmployees();
  }, []);

  // --- Hitung Kinerja Karyawan (Total Pekerjaan Selesai Bulan Ini) dari Backend ---
  useEffect(() => {
    const calculatePerformance = async () => {
      if (karyawanList.length === 0) {
        setEmployeePerformance([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/attendance/bymonth/${currentYear}/${currentMonth}`);
        const allMonthAttendanceRecords = response.data;

        const performanceDataMap = new Map();

        karyawanList.forEach(karyawan => {
          performanceDataMap.set(karyawan._id, {
            id: karyawan._id,
            namaLengkap: karyawan.namaLengkap,
            totalCompletedJobs: 0,
          });
        });

        allMonthAttendanceRecords.forEach(attRecord => {
          const employeeId = attRecord.employee?._id || attRecord.employee;
          const currentPerformance = performanceDataMap.get(employeeId);

          if (currentPerformance && Array.isArray(attRecord.pekerjaan)) {
            attRecord.pekerjaan.forEach(job => {
              if (job.completed) {
                currentPerformance.totalCompletedJobs += 1;
              }
            });
            performanceDataMap.set(employeeId, currentPerformance);
          }
        });
        
        const finalPerformanceData = Array.from(performanceDataMap.values())
          .sort((a, b) => b.totalCompletedJobs - a.totalCompletedJobs);
        
        setEmployeePerformance(finalPerformanceData);

      } catch (err) {
        console.error('Error calculating performance:', err);
        setError('Gagal menghitung kinerja karyawan.');
      } finally {
        setLoading(false);
      }
    };

    calculatePerformance();
  }, [karyawanList, currentMonth, currentYear]);


  // --- Hitung Ringkasan Kehadiran Hari Ini dari Backend ---
  useEffect(() => {
    const fetchTodayAttendanceSummary = async () => {
      if (karyawanList.length === 0) {
        setTotalHadirToday(0);
        setTotalAbsenToday(0);
        setTotalPulangToday(0);
        return;
      }

      try {
        const response = await axios.get(`${API_BASE_URL}/attendance/bydate/${getTodayDate()}`);
        const todayAttendanceRecords = response.data;

        let hadir = 0;
        let absen = 0;
        let pulang = 0;

        todayAttendanceRecords.forEach(attRecord => {
          if (attRecord.status === 'Hadir' && !attRecord.jamPulang) {
            hadir++;
          } else if (attRecord.status === 'Absen') {
            absen++;
          } else if (attRecord.jamPulang) {
            pulang++;
          }
          if (attRecord.status === 'Istirahat') {
            hadir++;
          }
        });

        setTotalHadirToday(hadir);
        setTotalAbsenToday(absen);
        setTotalPulangToday(pulang);

      } catch (err) {
        console.error('Error fetching today attendance summary:', err);
      }
    };

    fetchTodayAttendanceSummary();
  }, [karyawanList]);

  // Tampilan loading/error global
  if (loading && karyawanList.length === 0) {
    return <p className="loading-message">Memuat Dashboard...</p>;
  }
  if (error && karyawanList.length === 0) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <div className="dashboard-container">
      <h2>Dashboard Kinerja Karyawan Toko Amanah</h2>
      <p className="dashboard-slogan"></p>

      <div className="dashboard-cards-summary">
        <div className="card-summary">
          <h3>Total Karyawan</h3>
          <p>{karyawanList.length}</p>
        </div>
        <div className="card-summary">
          <h3>Hadir Hari Ini</h3>
          <p>{totalHadirToday}</p>
        </div>
        <div className="card-summary">
          <h3>Absen Hari Ini</h3>
          <p>{totalAbsenToday}</p>
        </div>
        <div className="card-summary">
          <h3>Sudah Pulang Hari Ini</h3>
          <p>{totalPulangToday}</p>
        </div>
      </div>

      <hr className="divider" />

      {/* Bagian untuk menampilkan data kinerja (sebagai pengganti grafik) */}
      <div className="performance-section">
        <h3>Kinerja Karyawan (Pekerjaan Selesai Bulan Ini: {new Date(currentYear, currentMonth - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })})</h3>
        
        {loading ? (
            <p className="loading-message">Menghitung kinerja...</p>
        ) : employeePerformance.length > 0 ? (
          // --- Komponen Bar Chart dari Recharts ---
          <div className="chart-container" style={{ width: '100%', height: 300 }}>
              <h4>Visualisasi Grafik Kinerja</h4>
              <p>Grafik Batang - Pekerjaan Selesai per Karyawan</p>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                      data={employeePerformance}
                      margin={{
                          top: 5, right: 30, left: 20, bottom: 5,
                      }}
                  >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="namaLengkap" tickLine={false} angle={-30} textAnchor="end" height={60} /> {/* Nama karyawan di sumbu X */}
                      <YAxis allowDecimals={false} /> {/* Jumlah pekerjaan di sumbu Y, pastikan bilangan bulat */}
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalCompletedJobs" fill="#0071CE" name="Pekerjaan Selesai" /> {/* Bar untuk jumlah pekerjaan */}
                  </BarChart>
              </ResponsiveContainer>
          </div>
          // --- Akhir Komponen Bar Chart ---
        ) : (
          <p>Tidak ada data kinerja pekerjaan yang diselesaikan untuk bulan ini.</p>
        )}

      </div>
    </div>
  );
};

export default Dashboard;