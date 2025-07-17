import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Absensi.css'; // Pastikan file CSS ini diupdate dengan yang baru

const API_BASE_URL = 'http://10.10.10.100:3001/api'; // URL dasar API backend Anda

// Fungsi utilitas untuk format tanggal YYYY-MM-DD
const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months start at 0!
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Fungsi format waktu untuk tampilan
const formatTime = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

// Fungsi format durasi dalam jam dan menit
const formatDuration = (milliseconds) => {
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours} jam ${remainingMinutes} menit`;
  }
  return `${remainingMinutes} menit`;
};

const Absensi = () => {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [karyawanList, setKaryawanList] = useState([]); // Daftar karyawan dari Master Data
  const [allAttendanceData, setAllAttendanceData] = useState([]); // Data absensi semua karyawan dari backend
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [newPekerjaanText, setNewPekerjaanText] = useState({});
  
  // >>> STATE BARU: Untuk tabel riwayat absensi harian di bawah
  const [dailyAttendanceHistory, setDailyAttendanceHistory] = useState([]);

  // --- Ambil Daftar Karyawan ---
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/employees`);
        setKaryawanList(response.data);
      } catch (err) {
        console.error('Error fetching employees:', err);
        setError('Gagal memuat daftar karyawan.');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  // --- Ambil Data Absensi untuk SEMUA Karyawan pada Tanggal yang Dipilih ---
  useEffect(() => {
    const fetchAllAttendance = async () => {
      if (selectedDate && karyawanList.length > 0) {
        setLoading(true);
        setError(null);
        try {
          const response = await axios.get(`${API_BASE_URL}/attendance/bydate/${selectedDate}`);
          setAllAttendanceData(response.data);

          const initialNewPekerjaanText = {};
          response.data.forEach(att => {
            const empId = att.employee?._id || att.employee;
            if (empId) {
                initialNewPekerjaanText[empId] = '';
            }
          });
          setNewPekerjaanText(initialNewPekerjaanText);

        } catch (err) {
          console.error('Error fetching all attendance for date:', err);
          setError('Gagal memuat data absensi untuk tanggal ini.');
          setAllAttendanceData([]);
        } finally {
          setLoading(false);
        }
      } else if (!selectedDate) {
        setAllAttendanceData([]);
      }
    };
    fetchAllAttendance();
  }, [selectedDate, karyawanList]);

  // --- Fungsi untuk Mengirim Update Absensi ke Backend ---
  const sendAttendanceUpdate = useCallback(async (employeeId, dataToUpdate) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/attendance/update`, dataToUpdate);
      setAllAttendanceData(prevData =>
        prevData.map(att =>
          (att.employee?._id || att.employee) === employeeId ? response.data : att
        )
      );
      setSuccessMessage('Absensi berhasil diperbarui!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
     catch (err) {
      console.error('Error updating attendance:', err.response?.data || err);
      setError(err.response?.data?.message || 'Gagal memperbarui absensi. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Handler untuk Aksi Absensi per Karyawan ---

  const handleAbsenMasuk = async (employeeId, currentAttendanceData) => {
    const now = new Date();
    const dataToUpdate = {
      employeeId: employeeId,
      date: selectedDate,
      status: 'Hadir',
      jamMasuk: now.toISOString(),
      pekerjaan: currentAttendanceData?.pekerjaan || [],
      totalIstirahatDurasi: currentAttendanceData?.totalIstirahatDurasi || 0,
      jamPulang: null,
      jamIstirahatMulai: null,
    };
    await sendAttendanceUpdate(employeeId, dataToUpdate);
  };

  const handleAbsenPulang = async (employeeId, currentAttendanceData) => {
    const now = new Date();
    let currentTotalIstirahatDurasi = currentAttendanceData?.totalIstirahatDurasi || 0;
    if (currentAttendanceData?.jamIstirahatMulai) {
      const istirahatMulai = new Date(currentAttendanceData.jamIstirahatMulai);
      currentTotalIstirahatDurasi += (now.getTime() - istirahatMulai.getTime());
    }

    const dataToUpdate = {
      employeeId: employeeId,
      date: selectedDate,
      status: 'Hadir', // Status tetap Hadir, tapi jamPulang diisi
      jamMasuk: currentAttendanceData?.jamMasuk,
      jamPulang: now.toISOString(),
      jamIstirahatMulai: null,
      totalIstirahatDurasi: currentTotalIstirahatDurasi,
      pekerjaan: currentAttendanceData?.pekerjaan || [],
    };
    await sendAttendanceUpdate(employeeId, dataToUpdate);
  };

  const handleIstirahat = async (employeeId, currentAttendanceData) => {
    const now = new Date();
    const dataToUpdate = {
      employeeId: employeeId,
      date: selectedDate,
      status: 'Istirahat',
      jamMasuk: currentAttendanceData?.jamMasuk,
      jamIstirahatMulai: now.toISOString(),
      pekerjaan: currentAttendanceData?.pekerjaan || [],
      totalIstirahatDurasi: currentAttendanceData?.totalIstirahatDurasi || 0,
    };
    await sendAttendanceUpdate(employeeId, dataToUpdate);
  };

  const handleSelesaiIstirahat = async (employeeId, currentAttendanceData) => {
    const now = new Date();
    if (!currentAttendanceData?.jamIstirahatMulai) {
      setError('Tidak ada waktu istirahat dimulai untuk diakhiri.');
      return;
    }

    const istirahatMulai = new Date(currentAttendanceData.jamIstirahatMulai);
    const durasiIstirahatSaatIni = now.getTime() - istirahatMulai.getTime();
    const newTotalIstirahatDurasi = (currentAttendanceData?.totalIstirahatDurasi || 0) + durasiIstirahatSaatIni;

    const dataToUpdate = {
      employeeId: employeeId,
      date: selectedDate,
      status: 'Hadir', // Kembali ke status Hadir
      jamMasuk: currentAttendanceData?.jamMasuk,
      jamIstirahatMulai: null, // Reset waktu mulai istirahat
      totalIstirahatDurasi: newTotalIstirahatDurasi,
      pekerjaan: currentAttendanceData?.pekerjaan || [],
    };
    await sendAttendanceUpdate(employeeId, dataToUpdate);
  };

  const handleAbsenSepanjangHari = async (employeeId, currentAttendanceData) => {
    const dataToUpdate = {
      employeeId: employeeId,
      date: selectedDate,
      status: 'Absen',
      jamMasuk: null,
      jamPulang: null,
      jamIstirahatMulai: null,
      totalIstirahatDurasi: 0,
      pekerjaan: [], // Reset pekerjaan jika absen
    };
    await sendAttendanceUpdate(employeeId, dataToUpdate);
  };

  // --- Handler untuk Pekerjaan per Karyawan (Input saja, tanpa display list) ---

  const handleNewPekerjaanTextChange = (employeeId, value) => {
    setNewPekerjaanText(prev => ({ ...prev, [employeeId]: value }));
  };

  const handleTambahPekerjaan = async (employeeId, currentAttendanceData) => {
    const text = newPekerjaanText[employeeId]?.trim();
    if (!text) {
      setError('Pekerjaan tidak boleh kosong.');
      return;
    }

    const updatedPekerjaan = [
      ...(Array.isArray(currentAttendanceData?.pekerjaan) ? currentAttendanceData.pekerjaan : []),
      { text: text, completed: false, completionTime: null }
    ];

    const dataToUpdate = {
      employeeId: employeeId,
      date: selectedDate,
      status: currentAttendanceData?.status || 'Belum Absen',
      jamMasuk: currentAttendanceData?.jamMasuk,
      jamPulang: currentAttendanceData?.jamPulang,
      jamIstirahatMulai: currentAttendanceData?.jamIstirahatMulai,
      totalIstirahatDurasi: currentAttendanceData?.totalIstirahatDurasi || 0,
      pekerjaan: updatedPekerjaan,
    };
    await sendAttendanceUpdate(employeeId, dataToUpdate);
    setNewPekerjaanText(prev => ({ ...prev, [employeeId]: '' })); // Bersihkan input spesifik
  };

  // Handler ini tidak lagi digunakan di Absensi karena list pekerjaan dihilangkan
  // Namun, tetap ada jika ada elemen UI lain yang menggunakannya untuk marking/deleting.
  const handleTogglePekerjaan = async (employeeId, currentAttendanceData, index) => {
    const updatedPekerjaan = [...(Array.isArray(currentAttendanceData?.pekerjaan) ? currentAttendanceData.pekerjaan : [])];
    const item = updatedPekerjaan[index];
    item.completed = !item.completed;
    item.completionTime = item.completed ? new Date().toISOString() : null;

    const dataToUpdate = {
      employeeId: employeeId,
      date: selectedDate,
      status: currentAttendanceData?.status || 'Belum Absen',
      jamMasuk: currentAttendanceData?.jamMasuk,
      jamPulang: currentAttendanceData?.jamPulang,
      jamIstirahatMulai: currentAttendanceData?.jamIstirahatMulai,
      totalIstirahatDurasi: currentAttendanceData?.totalIstirahatDurasi || 0,
      pekerjaan: updatedPekerjaan,
    };
    await sendAttendanceUpdate(employeeId, dataToUpdate);
  };

  const handleDeletePekerjaan = async (employeeId, currentAttendanceData, indexToDelete) => {
    const updatedPekerjaan = (Array.isArray(currentAttendanceData?.pekerjaan) ? currentAttendanceData.pekerjaan : []).filter((_, index) => index !== indexToDelete);

    const dataToUpdate = {
      employeeId: employeeId,
      date: selectedDate,
      status: currentAttendanceData?.status || 'Belum Absen',
      jamMasuk: currentAttendanceData?.jamMasuk,
      jamPulang: currentAttendanceData?.jamPulang,
      jamIstirahatMulai: currentAttendanceData?.jamIstirahatMulai,
      totalIstirahatDurasi: currentAttendanceData?.totalIstirahatDurasi || 0,
      pekerjaan: updatedPekerjaan,
    };
    await sendAttendanceUpdate(employeeId, dataToUpdate);
  };

  // --- BARU: Update Riwayat Absensi Harian untuk Tabel di Bawah ---
  useEffect(() => {
    const createDailyHistory = () => {
      const history = allAttendanceData.map(att => {
        const employeeName = att.employee?.namaLengkap || 'Nama Tidak Ditemukan';
        const totalIstirahatMinutes = Math.floor((att.totalIstirahatDurasi || 0) / (1000 * 60));
        const hours = Math.floor(totalIstirahatMinutes / 60);
        const minutes = totalIstirahatMinutes % 60;

        return {
          nama: employeeName,
          status: att.status,
          waktuUpdate: att.updatedAt ? new Date(att.updatedAt).toLocaleTimeString('id-ID') : '-',
          jamMasuk: formatTime(att.jamMasuk),
          jamPulang: formatTime(att.jamPulang),
          jamIstirahat: att.status === 'Istirahat' ? 'Sedang Istirahat' : (totalIstirahatMinutes > 0 ? `${hours} jam ${minutes} menit` : '-'),
          pekerjaan: Array.isArray(att.pekerjaan) && att.pekerjaan.length > 0 ? att.pekerjaan.map(p => p.text).join(', ') : '-',
        };
      });
      setDailyAttendanceHistory(history);
    };
    createDailyHistory();
  }, [allAttendanceData]); // Dipanggil setiap kali allAttendanceData berubah


  return (
    <div className="absensi-container">
      <h2>Absensi Karyawan</h2>

      <div className="date-picker-section">
        <label htmlFor="dateSelect">Tanggal Absensi:</label>
        <input
          type="date"
          id="dateSelect"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          disabled={loading}
        />
        {selectedDate !== getTodayDate() && (
          <p className="info-message">Anda sedang melihat absensi untuk tanggal lain. Hanya absensi hari ini yang dapat diubah.</p>
        )}
      </div>

      {loading && <p className="loading-message">Memuat data absensi...</p>}
      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      {!loading && !error && (
        <div className="karyawan-absensi-list">
          {karyawanList.length === 0 ? (
            <p className="info-message">Tidak ada karyawan yang ditemukan di Master Data. Silakan tambahkan karyawan terlebih dahulu.</p>
          ) : (
            allAttendanceData.map(att => {
              const employeeId = att.employee?._id || att.employee; 
              const employeeName = att.employee?.namaLengkap || 'Nama Karyawan Tidak Ditemukan'; 
              
              const isAbsen = att.status === 'Absen';
              const isHadir = att.status === 'Hadir';
              const isIstirahat = att.status === 'Istirahat';
              const sudahPulang = att.jamPulang !== null && att.jamPulang !== undefined;
              const canEditToday = selectedDate === getTodayDate();

              return (
                <div key={employeeId} className="absensi-card">
                  <h3>{employeeName}</h3>
                  <p className={`status-tag status-${att.status.toLowerCase().replace(' ', '-')}`}>
                    Status: <strong>{att.status}</strong>
                  </p>
                  <p>Jam Masuk: <strong>{formatTime(att.jamMasuk)}</strong></p>
                  <p>Jam Pulang: <strong>{formatTime(att.jamPulang)}</strong></p>
                  <p>Total Durasi Istirahat: <strong>{formatDuration(att.totalIstirahatDurasi)}</strong></p>

                  <div className="absensi-actions">
                    {/* Tombol Absen Sepanjang Hari: hanya jika belum hadir/istirahat/pulang */}
                    {!isHadir && !isIstirahat && !sudahPulang && (
                      <button className="btn-action btn-absent-all-day" onClick={() => handleAbsenSepanjangHari(employeeId, att)} disabled={loading || !canEditToday}>
                        Absen
                      </button>
                    )}
                    {/* Tombol Absen Masuk: hanya jika Belum Absen */}
                    {att.status === 'Belum Absen' && !sudahPulang && (
                      <button className="btn-action" onClick={() => handleAbsenMasuk(employeeId, att)} disabled={loading || !canEditToday}>Absen Masuk</button>
                    )}
                    {/* Tombol Istirahat: hanya jika Hadir dan belum Pulang */}
                    {isHadir && !sudahPulang && (
                      <button className="btn-action" onClick={() => handleIstirahat(employeeId, att)} disabled={loading || !canEditToday}>Istirahat</button>
                    )}
                    {/* Tombol Selesai Istirahat: hanya jika Istirahat */}
                    {isIstirahat && (
                      <button className="btn-action" onClick={() => handleSelesaiIstirahat(employeeId, att)} disabled={loading || !canEditToday}>Selesai Istirahat</button>
                    )}
                    {/* Tombol Pulang: hanya jika Hadir dan belum Pulang */}
                    {isHadir && !sudahPulang && (
                      <button className="btn-action btn-pulang" onClick={() => handleAbsenPulang(employeeId, att)} disabled={loading || !canEditToday}>Absen Pulang</button>
                    )}
                    {/* Pesan status di bawah tombol */}
                    {sudahPulang && (
                      <p className="info-message-small">Absensi untuk hari ini sudah selesai.</p>
                    )}
                     {isAbsen && (
                      <p className="info-message-small">Karyawan absen sepanjang hari.</p>
                    )}
                  </div>

                  {/* Pekerjaan Section: hanya tampil jika tidak absen sepanjang hari atau sudah pulang */}
                  {!isAbsen && !sudahPulang && (
                    <div className="pekerjaan-section">
                      <h3>Tambah Pekerjaan</h3> {/* >>> UBAH JUDUL SECTION */}
                      <div className="add-pekerjaan">
                        <input
                          type="text"
                          placeholder="Masukkan pekerjaan..."
                          value={newPekerjaanText[employeeId] || ''}
                          onChange={(e) => handleNewPekerjaanTextChange(employeeId, e.target.value)}
                          disabled={loading || !canEditToday}
                        />
                        <button
                          onClick={() => handleTambahPekerjaan(employeeId, att)}
                          disabled={loading || !canEditToday || (newPekerjaanText[employeeId]?.trim() === '')}
                        >
                          Tambah
                        </button>
                      </div>
                      {/* >>> DIHILANGKAN: att.pekerjaan && att.pekerjaan.length > 0 ? (...) : (...) */}
                      <p className="info-message-small">Pekerjaan yang sudah ditambahkan akan muncul di menu Monitoring.</p> {/* >>> PESAN BARU */}
                    </div>
                  )}
                </div>
              );
            })
          )}
           {/* Ini adalah pesan yang muncul jika allAttendanceData kosong */}
          {allAttendanceData.length === 0 && karyawanList.length > 0 && !loading && (
              <p className="info-message">Tidak ada data absensi yang tercatat untuk semua karyawan pada tanggal ini.</p>
          )}
        </div>
      )}

      <hr className="divider" />

      {/* >>> BAGIAN BARU: Riwayat Absensi Karyawan Hari Ini (Tabel Rekap) */}
      <div className="daily-history">
        <h3>Riwayat Absensi Karyawan Hari Ini ({selectedDate})</h3>
        {dailyAttendanceHistory.length > 0 ? (
          <table className="daily-history-table"> {/* Class baru untuk tabel ini */}
            <thead>
              <tr>
                <th>Nama Karyawan</th>
                <th>Status Absensi</th>
                <th>Terakhir Diperbarui</th>
                <th>Jam Masuk</th>
                <th>Jam Pulang</th>
                <th>Total Istirahat</th>
                <th>Pekerjaan</th>
              </tr>
            </thead>
            <tbody>
              {dailyAttendanceHistory.map((entry, index) => (
                <tr key={entry.nama + index}>
                  <td>{entry.nama}</td>
                  <td>{entry.status}</td>
                  <td>{entry.waktuUpdate}</td>
                  <td>{entry.jamMasuk}</td>
                  <td>{entry.jamPulang}</td>
                  <td>{entry.jamIstirahat}</td>
                  <td>{entry.pekerjaan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="info-message">Belum ada riwayat absensi untuk hari ini.</p>
        )}
      </div>
    </div>
  );
};

export default Absensi;
