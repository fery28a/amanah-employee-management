import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

import './Laporan.css';

const API_BASE_URL = 'http://localhost:5051/api';

const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

const Laporan = () => {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const [karyawanList, setKaryawanList] = useState([]);

  const [reportData, setReportData] = useState([]);
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

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/employees`);
        setKaryawanList(response.data);
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
  }, []);

  const generateReport = useCallback(async () => {
    if (!selectedEmployeeId || karyawanList.length === 0) {
      setReportData([]);
      setSummaryData({
        totalWorkingDays: 0,
        totalAbsentDays: 0,
        totalClockOutDays: 0,
        totalWorkingHours: { hours: 0, minutes: 0 },
        totalBreakHours: { hours: 0, minutes: 0 },
        overallPayableSalary: 0,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const employee = karyawanList.find(k => k._id === selectedEmployeeId);
      if (!employee) {
        setError('Karyawan tidak ditemukan.');
        setReportData([]);
        setSummaryData({
          totalWorkingDays: 0,
          totalAbsentDays: 0,
          totalClockOutDays: 0,
          totalWorkingHours: { hours: 0, minutes: 0 },
          totalBreakHours: { hours: 0, minutes: 0 },
          overallPayableSalary: 0,
        });
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/attendance/bymonth/${selectedYear}/${selectedMonth}`);
      const allMonthAttendanceRecords = response.data;

      const dailyRecords = [];
      let totalWorkingDays = 0;
      let totalAbsentDays = 0;
      let totalClockOutDays = 0;
      let totalEffectiveWorkingDurationMsOverall = 0; // For effective work hours summary
      let totalBreakDurationMsOverall = 0;
      let overallPayableSalary = 0;

      const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

      for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const absensiData = allMonthAttendanceRecords.find(att =>
          att.date === dateString && (att.employee?._id || att.employee) === employee._id
        );

        let status = 'Belum Absen';
        let jamMasuk = '-';
        let jamPulang = '-';
        let istirahatDurasi = '0 jam 0 menit';
        let totalJamKerjaHarian = '0 jam 0 menit'; // This will represent effective work duration
        let totalDurationClockInToOutHarian = '0 jam 0 menit'; // New: For salary calculation
        let gajiHarian = 0;
        let isLongBreak = false;

        if (absensiData) {
          status = absensiData.status;
          jamMasuk = absensiData.jamMasuk ? new Date(absensiData.jamMasuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
          jamPulang = absensiData.jamPulang ? new Date(absensiData.jamPulang).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

          let dailyEffectiveWorkingDurationMs = 0; // Duration excluding breaks
          let dailyTotalClockInToOutDurationMs = 0; // Total duration from clock-in to clock-out
          let dailyBreakDurationMs = absensiData.totalIstirahatDurasi || 0;
          totalBreakDurationMsOverall += dailyBreakDurationMs;

          if (Math.floor(dailyBreakDurationMs / (1000 * 60)) > 50) {
            isLongBreak = true;
          }

          if (absensiData.jamMasuk && absensiData.jamPulang) {
            const masukTime = new Date(absensiData.jamMasuk).getTime();
            const pulangTime = new Date(absensiData.jamPulang).getTime();

            dailyTotalClockInToOutDurationMs = pulangTime - masukTime; // Total time spent at work
            dailyEffectiveWorkingDurationMs = dailyTotalClockInToOutDurationMs - dailyBreakDurationMs; // Effective working time

            totalEffectiveWorkingDurationMsOverall += dailyEffectiveWorkingDurationMs;

            const dailyEffectiveWorkingMinutes = Math.floor(dailyEffectiveWorkingDurationMs / (1000 * 60));
            const effectiveHours = Math.floor(dailyEffectiveWorkingMinutes / 60);
            const effectiveMinutes = dailyEffectiveWorkingMinutes % 60;
            totalJamKerjaHarian = `${effectiveHours} jam ${effectiveMinutes} menit`;

            // Calculate duration from clock-in to clock-out for salary
            const dailyTotalDurationMinutes = Math.floor(dailyTotalClockInToOutDurationMs / (1000 * 60));
            const totalHours = Math.floor(dailyTotalDurationMinutes / 60);
            const totalMinutes = dailyTotalDurationMinutes % 60;
            totalDurationClockInToOutHarian = `${totalHours} jam ${totalMinutes} menit`;

            // *** Gaji Harian Calculation Change ***
            // Use total duration from clock-in to clock-out for salary calculation
            const dailySalaryHoursFloat = dailyTotalClockInToOutDurationMs / (1000 * 60 * 60);
            gajiHarian = Math.round(dailySalaryHoursFloat * employee.gajiPerJam);
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
          totalJamKerjaHarian: totalJamKerjaHarian, // This is still effective working time for display
          totalDurationClockInToOutHarian: totalDurationClockInToOutHarian, // New field for display if needed
          gajiHarian: gajiHarian,
        });
      }

      const totalEffectiveWorkingMinutesOverall = Math.floor(totalEffectiveWorkingDurationMsOverall / (1000 * 60));
      const overallEffectiveWorkingHours = Math.floor(totalEffectiveWorkingMinutesOverall / 60);
      const overallEffectiveWorkingMinutes = totalEffectiveWorkingMinutesOverall % 60;

      const totalBreakMinutesOverall = Math.floor(totalBreakDurationMsOverall / (1000 * 60));
      const overallBreakHours = Math.floor(totalBreakMinutesOverall / 60);
      const overallBreakMinutes = totalBreakMinutesOverall % 60;

      setReportData(dailyRecords);
      setSummaryData({
        totalWorkingDays: totalWorkingDays,
        totalAbsentDays: totalAbsentDays,
        totalClockOutDays: totalClockOutDays,
        totalWorkingHours: { hours: overallEffectiveWorkingHours, minutes: overallEffectiveWorkingMinutes }, // This remains effective working hours
        totalBreakHours: { hours: overallBreakHours, minutes: overallBreakMinutes },
        overallPayableSalary: Math.round(overallPayableSalary),
      });

    } catch (err) {
      console.error('Error generating report:', err.response?.data || err);
      setError('Gagal memuat laporan. Silakan coba lagi.');
      setReportData([]);
      setSummaryData({
        totalWorkingDays: 0,
        totalAbsentDays: 0,
        totalClockOutDays: 0,
        totalWorkingHours: { hours: 0, minutes: 0 },
        totalBreakHours: { hours: 0, minutes: 0 },
        overallPayableSalary: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId, selectedMonth, selectedYear, karyawanList]);

  useEffect(() => {
    if (karyawanList.length > 0 && selectedEmployeeId) {
      generateReport();
    }
  }, [generateReport, karyawanList, selectedEmployeeId]);

  const selectedEmployeeName = karyawanList.find(k => k._id === selectedEmployeeId)?.namaLengkap || 'Pilih Karyawan';
  const selectedEmployeeGajiPerJam = karyawanList.find(k => k._id === selectedEmployeeId)?.gajiPerJam || 0;

  const handleExportPdf = () => {
    if (!selectedEmployeeId || reportData.length === 0) {
      alert("Silakan pilih karyawan dan periode dengan data untuk mencetak laporan.");
      return;
    }
    window.print();
  };

  const handleExportXlsx = () => {
    if (reportData.length === 0 && !selectedEmployeeId) {
      alert("Tidak ada data laporan untuk diunduh.");
      return;
    }

    const reportFileName = `Laporan_${selectedEmployeeName}_${selectedYear}-${selectedMonth}.xlsx`;

    // --- Sheet 1: Laporan Harian ---
    const dailyHeaders = [
      "Tanggal", "Status", "Jam Masuk", "Jam Pulang", "Total Istirahat",
      "Total Jam Kerja Efektif", // Renamed for clarity in Excel
      "Gaji Harian"
    ];
    const dailyData = reportData.map(record => [
      record.date,
      record.status,
      record.jamMasuk,
      record.jamPulang,
      record.istirahatDurasi,
      record.totalJamKerjaHarian, // This is still effective working time
      record.gajiHarian
    ]);

    const dailyWsData = [dailyHeaders, ...dailyData];
    const dailyWs = XLSX.utils.aoa_to_sheet(dailyWsData);


    // --- Sheet 2: Ringkasan Total ---
    const summaryDataForSheet = [
      ["Ringkasan Total"],
      ["Item", "Nilai"],
      ["Nama Karyawan", selectedEmployeeName],
      ["Periode", `${new Date(selectedYear, selectedMonth - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`],
      ["Gaji per Jam", selectedEmployeeGajiPerJam],
      ["Jumlah Hari Kerja (Hadir/Pulang)", `${summaryData.totalWorkingDays} hari`],
      ["Jumlah Hari Absen (Tidak Tercatat/Absen)", `${summaryData.totalAbsentDays} hari`],
      ["Jumlah Hari Tercatat Pulang", `${summaryData.totalClockOutDays} hari`],
      ["Total Jam Kerja Efektif", `${summaryData.totalWorkingHours.hours} jam ${summaryData.totalWorkingHours.minutes} menit`],
      ["Total Waktu Istirahat", `${summaryData.totalBreakHours.hours} jam ${summaryData.totalBreakHours.minutes} menit`],
      ["Total Gaji Keseluruhan (Periode Ini)", summaryData.overallPayableSalary]
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
                  <th>Total Jam Kerja Efektif</th> {/* Changed header text */}
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
                    <td>{record.totalJamKerjaHarian}</td> {/* This still displays effective work */}
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
