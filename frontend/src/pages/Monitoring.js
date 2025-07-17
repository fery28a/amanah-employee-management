import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Monitoring.css';

const API_BASE_URL = 'http://10.10.10.100:3001/api'; // URL dasar API backend Anda

// Fungsi helper untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Komponen utama untuk halaman Monitoring
const Monitoring = () => {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [karyawanList, setKaryawanList] = useState([]); // Daftar karyawan dari backend
  const [monitoredEmployees, setMonitoredEmployees] = useState([]); // Data absensi & pekerjaan yang dimonitor
  const [completedJobsHistory, setCompletedJobsHistory] = useState([]); // Riwayat pekerjaan selesai
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- Ambil Daftar Karyawan (untuk mendapatkan nama lengkap) ---
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/employees`);
        setKaryawanList(response.data);
      } catch (err) {
        console.error('Error fetching employees for monitoring:', err);
        setError('Gagal memuat daftar karyawan.');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  // --- Ambil Data Absensi & Pekerjaan untuk SEMUA Karyawan pada Tanggal yang Dipilih ---
  useEffect(() => {
    const loadMonitoringData = async () => {
      if (!selectedDate || karyawanList.length === 0) {
        setMonitoredEmployees([]);
        setCompletedJobsHistory([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/attendance/bydate/${selectedDate}`);
        const allAttendanceRecords = response.data; // Ini sudah termasuk populated employee data

        const dataForMonitoring = [];
        const currentCompletedJobs = [];

        allAttendanceRecords.forEach(attRecord => {
          // Pastikan employee terpopulasi dan ada
          const employeeId = attRecord.employee?._id || attRecord.employee;
          const employeeName = attRecord.employee?.namaLengkap || 'Nama Karyawan Tidak Ditemukan';

          // Tentukan status kehadiran yang akan ditampilkan di monitoring
          let displayStatus = 'Tidak Hadir';
          if (attRecord.status === 'Hadir' && attRecord.jamPulang) {
            displayStatus = 'Sudah Pulang';
          } else if (attRecord.status === 'Istirahat') {
            displayStatus = 'Sedang Istirahat';
          } else if (attRecord.status === 'Hadir') {
            displayStatus = 'Hadir';
          } else if (attRecord.status === 'Absen') {
            displayStatus = 'Absen';
          }

          // Hanya tampilkan karyawan yang Hadir, Sedang Istirahat, atau Sudah Pulang
          if (displayStatus === 'Hadir' || displayStatus === 'Sedang Istirahat' || displayStatus === 'Sudah Pulang') {
            const jobsWithStatus = Array.isArray(attRecord.pekerjaan)
              ? attRecord.pekerjaan.map((job, index) => {
                  // Job status key tidak lagi dari localStorage, tapi dari objek job itu sendiri
                  // Waktu penyelesaian sudah ada di job.completionTime
                  if (job.completed) {
                      currentCompletedJobs.push({
                          employeeName: employeeName,
                          job: job.text,
                          completedAt: job.completionTime ? new Date(job.completionTime).toLocaleTimeString('id-ID') : '-'
                      });
                  }
                  return {
                    ...job, // Sertakan semua properti job dari backend (text, completed, completionTime)
                    id: job._id || index, // Gunakan _id jika ada, atau index sebagai fallback
                  };
                })
              : [];

            dataForMonitoring.push({
              id: employeeId,
              namaLengkap: employeeName,
              status: displayStatus,
              pekerjaan: jobsWithStatus,
              fullAttendanceRecord: attRecord // Simpan objek absensi lengkap untuk pembaruan
            });
          }
        });
        setMonitoredEmployees(dataForMonitoring);
        // Urutkan riwayat pekerjaan selesai berdasarkan waktu penyelesaian
        setCompletedJobsHistory(currentCompletedJobs.sort((a, b) => {
            const timeA = a.completedAt !== '-' ? new Date(`2000/01/01 ${a.completedAt}`).getTime() : 0;
            const timeB = b.completedAt !== '-' ? new Date(`2000/01/01 ${b.completedAt}`).getTime() : 0;
            return timeA - timeB;
        }));
      } catch (err) {
        console.error('Error fetching monitoring data:', err);
        setError('Gagal memuat data monitoring.');
      } finally {
        setLoading(false);
      }
    };

    loadMonitoringData();
  }, [selectedDate, karyawanList]); // Dipanggil ulang jika tanggal atau daftar karyawan berubah

  // Handler untuk menandai pekerjaan sebagai selesai
  const handleCompleteJob = async (employeeId, jobId, jobText) => {
    setLoading(true);
    setError(null);

    try {
      // Temukan objek absensi lengkap untuk karyawan ini dari state
      const employeeMonitorData = monitoredEmployees.find(emp => emp.id === employeeId);
      if (!employeeMonitorData || !employeeMonitorData.fullAttendanceRecord) {
        throw new Error('Data absensi karyawan tidak ditemukan.');
      }

      const fullAttendanceRecord = employeeMonitorData.fullAttendanceRecord;
      const updatedPekerjaan = Array.isArray(fullAttendanceRecord.pekerjaan)
        ? fullAttendanceRecord.pekerjaan.map(job => {
            if ((job._id?.toString() || job.id) === jobId) { // Perbandingan _id atau id fallback
              return { ...job, completed: true, completionTime: new Date().toISOString() };
            }
            return job;
          })
        : [];

      // Siapkan data untuk dikirim ke backend
      const dataToUpdate = {
        employeeId: employeeId,
        date: selectedDate,
        status: fullAttendanceRecord.status,
        jamMasuk: fullAttendanceRecord.jamMasuk,
        jamPulang: fullAttendanceRecord.jamPulang,
        jamIstirahatMulai: fullAttendanceRecord.jamIstirahatMulai,
        totalIstirahatDurasi: fullAttendanceRecord.totalIstirahatDurasi,
        pekerjaan: updatedPekerjaan, // Kirim array pekerjaan yang sudah diupdate
      };

      // Kirim pembaruan ke backend
      const response = await axios.post(`${API_BASE_URL}/attendance/update`, dataToUpdate);

      // Perbarui state monitoredEmployees dan completedJobsHistory di frontend setelah sukses
      setMonitoredEmployees(prevEmployees => {
        return prevEmployees.map(emp => {
          if (emp.id === employeeId) {
            return {
              ...emp,
              pekerjaan: updatedPekerjaan, // Update pekerjaan di objek monitoring
              fullAttendanceRecord: response.data // Update full record dari response backend
            };
          }
          return emp;
        });
      });

      // Tambahkan pekerjaan ke riwayat selesai jika belum ada
      setCompletedJobsHistory(prevHistory => {
          const isAlreadyInHistory = prevHistory.some(rec => rec.employeeName === employeeMonitorData.namaLengkap && rec.job === jobText && rec.completedAt !== '-');
          if (!isAlreadyInHistory) {
              const newRecord = {
                  employeeName: employeeMonitorData.namaLengkap,
                  job: jobText,
                  completedAt: new Date().toLocaleTimeString('id-ID')
              };
              return [...prevHistory, newRecord].sort((a,b) => {
                  const timeA = a.completedAt !== '-' ? new Date(`2000/01/01 ${a.completedAt}`).getTime() : 0;
                  const timeB = b.completedAt !== '-' ? new Date(`2000/01/01 ${b.completedAt}`).getTime() : 0;
                  return timeA - timeB;
              });
          }
          return prevHistory;
      });

    } catch (err) {
      console.error('Error completing job:', err.response?.data || err);
      setError(err.response?.data?.message || 'Gagal menandai pekerjaan selesai. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="monitoring-container">
      <h2>Monitoring Pekerjaan Karyawan</h2>

      <div className="date-picker-section">
        <label htmlFor="monitoringDate">Pilih Tanggal:</label>
        <input
          type="date"
          id="monitoringDate"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          disabled={loading}
        />
        {selectedDate !== getTodayDate() && (
          <p className="info-message">Anda sedang melihat pekerjaan untuk tanggal lain. Status pekerjaan hanya dapat diubah untuk hari ini.</p>
        )}
      </div>

      {loading && <p className="loading-message">Memuat data monitoring...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && (
        <div className="monitored-employees-list">
          {karyawanList.length === 0 ? (
            <p className="info-message">Tidak ada karyawan di Master Data. Silakan tambahkan karyawan terlebih dahulu.</p>
          ) : monitoredEmployees.length > 0 ? (
            monitoredEmployees.map(employee => (
              <div key={employee.id} className="employee-monitoring-card">
                <h3>{employee.namaLengkap}</h3>
                <p className={`status-tag status-${employee.status.toLowerCase().replace(' ', '-')}`}>
                  Status: <strong>{employee.status}</strong>
                </p>

                {employee.pekerjaan && employee.pekerjaan.length > 0 ? (
                  <div className="assigned-jobs-section">
                    <h4>Pekerjaan yang Ditugaskan:</h4>
                    <ul className="job-list-monitoring">
                      {employee.pekerjaan.map(job => (
                        <li key={job.id} className={job.completed ? 'job-completed' : ''}>
                          <span>{job.text}</span>
                          <button
                            className="btn-complete-job"
                            onClick={() => handleCompleteJob(employee.id, job.id, job.text)}
                            disabled={job.completed || selectedDate !== getTodayDate()}
                          >
                            {job.completed ? 'Selesai' : 'Tandai Selesai'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="no-jobs-message">Tidak ada pekerjaan yang ditugaskan untuk karyawan ini.</p>
                )}
              </div>
            ))
          ) : (
            <p className="no-employees-message">Tidak ada karyawan yang hadir dengan pekerjaan untuk tanggal ini.</p>
          )}
        </div>
      )}

      <hr className="divider" />

      {/* Bagian Riwayat Pekerjaan yang Diselesaikan */}
      <div className="completed-jobs-history-section">
        <h3>Riwayat Pekerjaan yang Diselesaikan ({selectedDate})</h3>
        {completedJobsHistory.length > 0 ? (
          <table className="completed-jobs-table">
            <thead>
              <tr>
                <th>Nama Karyawan</th>
                <th>Pekerjaan</th>
                <th>Waktu Selesai</th>
              </tr>
            </thead>
            <tbody>
              {completedJobsHistory.map((job, index) => (
                <tr key={job.employeeName + job.completedAt + index}>
                  <td>{job.employeeName}</td>
                  <td>{job.job}</td>
                  <td>{job.completedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-completed-jobs">Belum ada pekerjaan yang diselesaikan untuk tanggal ini.</p>
        )}
      </div>
    </div>
  );
};

export default Monitoring;
