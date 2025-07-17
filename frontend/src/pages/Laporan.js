import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Import axios
import * as XLSX from 'xlsx'; // Import library XLSX
// Hapus import jsPDF dan jspdf-autotable jika tidak digunakan lagi
// import jsPDF from 'jspdf';
// import 'jspdf-autotable';

import './Laporan.css';

const API_BASE_URL = 'http://10.10.10.100:3001/api'; // URL dasar API backend Anda

// Fungsi helper untuk mendapatkan jumlah hari dalam bulan tertentu
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

const Laporan = () => {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(''); // Untuk memilih karyawan

  // State untuk daftar karyawan dari backend
  const [karyawanList, setKaryawanList] = useState([]); // Inisialisasi kosong

  // State untuk menyimpan data laporan per hari
  const [reportData, setReportData] = useState([]);
  // State untuk menyimpan ringkasan total
  const [summaryData, setSummaryData] = useState({
    totalWorkingDays: 0,
    totalAbsentDays: 0,
    totalClockOutDays: 0,
    totalWorkingHours: { hours: 0, minutes: 0 },
    totalBreakHours: { hours: 0, minutes: 0 },
    overallPayableSalary: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- Ambil Daftar Karyawan dari Backend ---
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/employees`);
        setKaryawanList(response.data);
        // Set default selected employee to the first one if list is not empty
        if (response.data.length > 0) {
          setSelectedEmployeeId(response.data[0]._id);
        }
      } catch (err) {
        console.error('Error fetching employees for report:', err);
        setError('Gagal memuat daftar karyawan untuk laporan.');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []); // Hanya berjalan sekali saat mount

  // Fungsi untuk menghasilkan laporan (diperbarui untuk mengambil data dari backend)
  const generateReport = useCallback(async () => {
    if (!selectedEmployeeId || karyawanList.length === 0) {
      setReportData([]);
      setSummaryData({ /* reset */ });
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const employee = karyawanList.find(k => k._id === selectedEmployeeId);
      if (!employee) {
        setError('Karyawan tidak ditemukan.');
        setReportData([]);
        setSummaryData({ /* reset */ });
        setLoading(false);
        return;
      }

      // Ambil semua catatan absensi untuk bulan ini dari backend
      const response = await axios.get(`${API_BASE_URL}/attendance/bymonth/${selectedYear}/${selectedMonth}`);
      const allMonthAttendanceRecords = response.data;

      const dailyRecords = [];
      let totalWorkingDays = 0;
      let totalAbsentDays = 0;
      let totalClockOutDays = 0;
      let totalWorkingDurationMsOverall = 0;
      let totalBreakDurationMsOverall = 0;
      let overallPayableSalary = 0;

      const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

      for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Cari catatan absensi untuk karyawan dan tanggal ini dari data yang sudah diambil
        const absensiData = allMonthAttendanceRecords.find(att =>
          att.date === dateString && (att.employee?._id || att.employee) === employee._id
        );

        let status = 'Belum Absen';
        let jamMasuk = '-';
        let jamPulang = '-';
        let istirahatDurasi = '0 jam 0 menit';
        let totalJamKerjaHarian = '0 jam 0 menit';
        let gajiHarian = 0;
        let isLongBreak = false;

        if (absensiData) {
          status = absensiData.status;
          jamMasuk = absensiData.jamMasuk ? new Date(absensiData.jamMasuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
          jamPulang = absensiData.jamPulang ? new Date(absensiData.jamPulang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

          let dailyWorkingDurationMs = 0;
          let dailyBreakDurationMs = absensiData.totalIstirahatDurasi || 0;
          totalBreakDurationMsOverall += dailyBreakDurationMs;

          if (Math.floor(dailyBreakDurationMs / (1000 * 60)) > 50) {
              isLongBreak = true;
          }

          if (absensiData.jamMasuk && absensiData.jamPulang) {
            const masukTime = new Date(absensiData.jamMasuk).getTime();
            const pulangTime = new Date(absensiData.jamPulang).getTime();
            dailyWorkingDurationMs = pulangTime - masukTime - dailyBreakDurationMs;
            totalWorkingDurationMsOverall += dailyWorkingDurationMs;

            const dailyWorkingMinutes = Math.floor(dailyWorkingDurationMs / (1000 * 60));
            const hours = Math.floor(dailyWorkingMinutes / 60);
            const minutes = dailyWorkingMinutes % 60;
            totalJamKerjaHarian = `${hours} jam ${minutes} menit`;

            const dailyWorkingHoursFloat = dailyWorkingDurationMs / (1000 * 60 * 60);
            gajiHarian = Math.round(dailyWorkingHoursFloat * employee.gajiPerJam);
            overallPayableSalary += gajiHarian;

            totalClockOutDays++;
          }

          const breakMinutes = Math.floor(dailyBreakDurationMs / (1000 * 60));
          const breakHours = Math.floor(breakMinutes / 60);
          const remainingBreakMinutes = breakMinutes % 60;
          istirahatDurasi = `${breakHours} jam ${remainingBreakMinutes} menit`;

          if (status === 'Hadir' || absensiData.jamPulang) {
            totalWorkingDays++;
          } else if (status === 'Absen') {
            totalAbsentDays++;
          }
        } else {
          // Jika tidak ada data absensi untuk hari itu, anggap absen
          status = 'Tidak Tercatat (Absen)';
          totalAbsentDays++;
        }

        dailyRecords.push({
          date: dateString,
          status: status,
          jamMasuk: jamMasuk,
          jamPulang: jamPulang,
          istirahatDurasi: istirahatDurasi,
          isLongBreak: isLongBreak,
          totalJamKerjaHarian: totalJamKerjaHarian,
          gajiHarian: gajiHarian,
        });
      }

      const totalWorkingMinutesOverall = Math.floor(totalWorkingDurationMsOverall / (1000 * 60));
      const overallWorkingHours = Math.floor(totalWorkingMinutesOverall / 60);
      const overallWorkingMinutes = totalWorkingMinutesOverall % 60;

      const totalBreakMinutesOverall = Math.floor(totalBreakDurationMsOverall / (1000 * 60));
      const overallBreakHours = Math.floor(totalBreakMinutesOverall / 60);
      const overallBreakMinutes = totalBreakMinutesOverall % 60;

      setReportData(dailyRecords);
      setSummaryData({
        totalWorkingDays: totalWorkingDays,
        totalAbsentDays: totalAbsentDays,
        totalClockOutDays: totalClockOutDays,
        totalWorkingHours: { hours: overallWorkingHours, minutes: overallWorkingMinutes },
        totalBreakHours: { hours: overallBreakHours, minutes: overallBreakMinutes },
        overallPayableSalary: Math.round(overallPayableSalary),
      });

    } catch (err) {
      console.error('Error generating report:', err.response?.data || err);
      setError('Gagal memuat laporan. Silakan coba lagi.');
      setReportData([]);
      setSummaryData({ /* reset */ });
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId, selectedMonth, selectedYear, karyawanList]); // Tambah karyawanList sebagai dependensi

  // Panggil generateReport setiap kali parameter berubah
  useEffect(() => {
    // Pastikan karyawanList sudah dimuat sebelum generateReport dipanggil
    if (karyawanList.length > 0 && selectedEmployeeId) {
      generateReport();
    }
  }, [generateReport, karyawanList, selectedEmployeeId]); // Tambah karyawanList dan selectedEmployeeId ke dependensi

  const selectedEmployeeName = karyawanList.find(k => k._id === selectedEmployeeId)?.namaLengkap || 'Pilih Karyawan';
  const selectedEmployeeGajiPerJam = karyawanList.find(k => k._id === selectedEmployeeId)?.gajiPerJam || 0;

  // Fungsi untuk Cetak PDF (menggunakan window.print())
  const handleExportPdf = () => {
    if (!selectedEmployeeId || reportData.length === 0) {
      alert("Silakan pilih karyawan dan periode dengan data untuk mencetak laporan.");
      return;
    }
    window.print();
  };

  // Fungsi untuk Export XLSX
  const handleExportXlsx = () => {
    if (reportData.length === 0 && !selectedEmployeeId) {
      alert("Tidak ada data laporan untuk diunduh.");
      return;
    }

    const reportFileName = `Laporan_${selectedEmployeeName}_${selectedYear}-${selectedMonth}.xlsx`;

    // --- Sheet 1: Laporan Harian ---
    const dailyHeaders = [
      "Tanggal", "Status", "Jam Masuk", "Jam Pulang", "Total Istirahat",
      "Total Jam Kerja", "Gaji Harian"
    ];
    const dailyData = reportData.map(record => [
      record.date,
      record.status,
      record.jamMasuk,
      record.jamPulang,
      record.istirahatDurasi,
      record.totalJamKerjaHarian,
      record.gajiHarian // Biarkan sebagai angka untuk Excel
    ]);

    const dailyWsData = [dailyHeaders, ...dailyData];
    const dailyWs = XLSX.utils.aoa_to_sheet(dailyWsData);


    // --- Sheet 2: Ringkasan Total ---
    const summaryDataForSheet = [
        ["Ringkasan Total"],
        ["Item", "Nilai"],
        ["Nama Karyawan", selectedEmployeeName],
        ["Periode", `${new Date(selectedYear, selectedMonth - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`],
        ["Gaji per Jam", selectedEmployeeGajiPerJam], // Pastikan ini angka jika ingin format di Excel
        ["Jumlah Hari Kerja (Hadir/Pulang)", `${summaryData.totalWorkingDays} hari`],
        ["Jumlah Hari Absen (Tidak Tercatat/Absen)", `${summaryData.totalAbsentDays} hari`],
        ["Jumlah Hari Tercatat Pulang", `${summaryData.totalClockOutDays} hari`],
        ["Total Jam Kerja Efektif", `${summaryData.totalWorkingHours.hours} jam ${summaryData.totalWorkingHours.minutes} menit`],
        ["Total Waktu Istirahat", `${summaryData.totalBreakHours.hours} jam ${summaryData.totalBreakHours.minutes} menit`],
        ["Total Gaji Keseluruhan (Periode Ini)", summaryData.overallPayableSalary] // Biarkan angka
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryDataForSheet);


    // --- Buat Workbook dan Tambahkan Sheets ---
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, dailyWs, "Laporan Harian");
    XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");


    // --- Tulis File XLSX ---
    XLSX.writeFile(wb, reportFileName);
  };


  return (
    <div className="laporan-container">
      <h2>Laporan Absensi & Gaji Karyawan</h2>

      <div className="report-controls">
        <div className="period-selector-section">
          <label htmlFor="month-select">Pilih Periode:</label>
          <select
            id="month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            disabled={loading}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            disabled={loading}
          >
            {Array.from({ length: 5 }, (_, i) => {
              const year = today.getFullYear() - 2 + i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>

        <div className="employee-selector-section">
          <label htmlFor="employee-select">Pilih Karyawan:</label>
          <select
            id="employee-select"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            disabled={loading || karyawanList.length === 0}
          >
            <option value="">-- Pilih Karyawan --</option>
            {karyawanList.map(karyawan => (
              <option key={karyawan._id} value={karyawan._id}>
                {karyawan.namaLengkap}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="loading-message">Memuat laporan...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && karyawanList.length === 0 && (
          <p className="info-message">Tidak ada karyawan di Master Data. Silakan tambahkan karyawan terlebih dahulu.</p>
      )}

      {!loading && !error && karyawanList.length > 0 && !selectedEmployeeId && (
        <p className="no-selection-message">Silakan pilih karyawan untuk melihat laporan.</p>
      )}

      {!loading && !error && selectedEmployeeId && (
        <div className="report-content">
          <h3>Laporan untuk {selectedEmployeeName} - {new Date(selectedYear, selectedMonth - 1).toLocaleString('id-ID', { month: 'long' })} {selectedYear}</h3>
          
          <div className="report-table-container">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Status</th>
                  <th>Jam Masuk</th>
                  <th>Jam Pulang</th>
                  <th className="break-time-header">Total Istirahat</th>
                  <th>Total Jam Kerja</th>
                  <th>Gaji Harian</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((record) => (
                  <tr key={record.date}>
                    <td>{record.date}</td>
                    <td>{record.status}</td>
                    <td>{record.jamMasuk}</td>
                    <td>{record.jamPulang}</td>
                    <td className={record.isLongBreak ? 'long-break-warning' : ''}>{record.istirahatDurasi}</td>
                    <td>{record.totalJamKerjaHarian}</td>
                    <td>Rp {record.gajiHarian.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="report-summary">
            <h4>Ringkasan Total:</h4>
            <p>Jumlah Hari Kerja (Hadir/Pulang): <strong>{summaryData.totalWorkingDays} hari</strong></p>
            <p>Jumlah Hari Absen (Tidak Tercatat/Absen): <strong>{summaryData.totalAbsentDays} hari</strong></p>
            <p>Jumlah Hari Tercatat Pulang: <strong>{summaryData.totalClockOutDays} hari</strong></p>
            <p>Total Jam Kerja Efektif: <strong>{summaryData.totalWorkingHours.hours} jam {summaryData.totalWorkingHours.minutes} menit</strong></p>
            <p>Total Waktu Istirahat: <strong>{summaryData.totalBreakHours.hours} jam {summaryData.totalBreakHours.minutes} menit</strong></p>
            <p className="total-gaji">Total Gaji Keseluruhan (Periode Ini): <strong>Rp {summaryData.overallPayableSalary.toLocaleString('id-ID')}</strong></p>
          </div>

          <div className="export-buttons-section">
            <button className="btn-export-pdf" onClick={handleExportPdf}>
              Cetak PDF
            </button>
            <button className="btn-export-csv" onClick={handleExportXlsx}>
              Unduh Excel (XLSX)
            </button>
          </div>

        </div>
      )}
      {reportData.length === 0 && !loading && !error && selectedEmployeeId && (
          <p className="info-message">Tidak ada data absensi untuk karyawan ini pada periode yang dipilih.</p>
      )}
    </div>
  );
};

export default Laporan;
