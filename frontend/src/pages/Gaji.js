import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Gaji.css';

const API_BASE_URL = 'http://10.10.10.100:3001/api'; // URL dasar API backend Anda

// Fungsi helper untuk mendapatkan jumlah hari dalam bulan tertentu
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

const Gaji = () => {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const [karyawanList, setKaryawanList] = useState([]);
  const [salaryData, setSalaryData] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedHistory = JSON.parse(localStorage.getItem('salary_payment_history')) || [];
    setPaymentHistory(storedHistory);
  }, []);

  // --- Ambil Daftar Karyawan dari Backend ---
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/employees`);
        setKaryawanList(response.data); // Data karyawan sudah termasuk gajiPerJam dan uangMakanHarian
      } catch (err) {
        console.error('Error fetching employees for salary:', err);
        setError('Gagal memuat daftar karyawan untuk perhitungan gaji.');
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []); // Hanya berjalan sekali saat mount

  // Fungsi untuk menghitung gaji per karyawan (diperbarui untuk mengambil data dari backend)
  const calculateEmployeeSalary = useCallback(async (employee, month, year) => {
    let allMonthAttendance = [];
    try {
        const response = await axios.get(`${API_BASE_URL}/attendance/bymonth/${year}/${month}`);
        allMonthAttendance = response.data;
    } catch (err) {
        console.error(`Error fetching attendance for ${employee.namaLengkap} in ${month}/${year}:`, err);
        return {
            employeeId: employee._id,
            namaLengkap: employee.namaLengkap,
            gajiPerJam: employee.gajiPerJam ?? 0, // Fallback ke 0
            uangMakanHarian: employee.uangMakanHarian ?? 0, // Fallback ke 0
            totalWorkingHoursFloat: 0,
            totalWorkingDuration: { hours: 0, minutes: 0 },
            totalBreakDuration: { hours: 0, minutes: 0 },
            totalCompletedJobs: 0,
            totalDaysPresent: 0,
            totalDaysAbsent: 0,
            totalUangMakan: 0, // Inisialisasi total uang makan
            gajiBersihDihitung: 0,
        };
    }

    let totalWorkingDurationMs = 0; // Ini akan menjadi total durasi dari masuk sampai pulang
    let totalBreakDurationMs = 0; // Tetap hitung total istirahat untuk informasi
    let totalCompletedJobs = 0;
    let totalDaysPresent = 0;
    let totalDaysAbsent = 0;
    
    const employeeAttendancesForMonth = allMonthAttendance.filter(att => 
        (att.employee?._id || att.employee) === employee._id
    );

    employeeAttendancesForMonth.forEach(absensiData => {
      if (absensiData.status === 'Hadir' || absensiData.status === 'Istirahat' || absensiData.jamPulang) {
        totalDaysPresent++; 

        if (absensiData.jamMasuk && absensiData.jamPulang) {
          const masukTime = new Date(absensiData.jamMasuk).getTime();
          const pulangTime = new Date(absensiData.jamPulang).getTime();
          
          // >>> PERUBAHAN UTAMA DI SINI: Waktu istirahat TIDAK DIKURANGI dari jam kerja
          let grossWorkingTime = pulangTime - masukTime; 
          
          totalWorkingDurationMs += grossWorkingTime; // Tambahkan total durasi masuk-pulang
          totalBreakDurationMs += absensiData.totalIstirahatDurasi || 0; // Tetap akumulasi durasi istirahat
        }
      } else if (absensiData.status === 'Absen') {
        totalDaysAbsent++;
      }

      if (Array.isArray(absensiData.pekerjaan)) {
        absensiData.pekerjaan.forEach(job => {
          if (job.completed) {
            totalCompletedJobs++;
          }
        });
      }
    });

    const totalWorkingHoursFloat = totalWorkingDurationMs / (1000 * 60 * 60); // Ini sekarang adalah jam kotor
    const totalBreakMinutes = Math.floor(totalBreakDurationMs / (1000 * 60));
    const breakHours = Math.floor(totalBreakMinutes / 60);
    const breakMinutes = totalBreakMinutes % 60;

    const gajiPerJam = employee.gajiPerJam ?? 0;
    const uangMakanHarian = employee.uangMakanHarian ?? 0;

    const gajiBersihJamKerja = totalWorkingHoursFloat * gajiPerJam; // Gaji dari jam kotor
    const totalUangMakan = totalDaysPresent * uangMakanHarian;

    const gajiBersihDihitung = Math.round(gajiBersihJamKerja + totalUangMakan);

    return {
      employeeId: employee._id,
      namaLengkap: employee.namaLengkap,
      gajiPerJam: gajiPerJam,
      uangMakanHarian: uangMakanHarian,
      totalWorkingHoursFloat: totalWorkingHoursFloat,
      totalWorkingDuration: { hours: Math.floor(totalWorkingHoursFloat), minutes: Math.round((totalWorkingHoursFloat % 1) * 60) },
      totalBreakDuration: { hours: breakHours, minutes: breakMinutes },
      totalCompletedJobs: totalCompletedJobs,
      totalDaysPresent: totalDaysPresent,
      totalDaysAbsent: totalDaysAbsent,
      totalUangMakan: totalUangMakan,
      gajiBersihDihitung: gajiBersihDihitung,
    };
  }, []);

  useEffect(() => {
    const runSalaryCalculation = async () => {
      if (karyawanList.length === 0) {
        setSalaryData([]);
        return;
      }
      setLoading(true);
      setError(null);
      const newSalaryDataPromises = karyawanList.map(karyawan =>
        calculateEmployeeSalary(karyawan, selectedMonth, selectedYear)
      );
      try {
        const newSalaryData = await Promise.all(newSalaryDataPromises);
        setSalaryData(newSalaryData);
      } catch (err) {
        console.error("Error running salary calculation:", err);
        setError("Gagal menghitung gaji. Coba lagi.");
      } finally {
        setLoading(false);
      }
    };
    runSalaryCalculation();
  }, [selectedMonth, selectedYear, karyawanList, calculateEmployeeSalary]);

  const handlePaySalary = (employeeId, employeeName, calculatedBaseSalary, totalUangMakan) => {
    const period = `${new Date(selectedYear, selectedMonth - 1).toLocaleString('id-ID', { month: 'long' })} ${selectedYear}`;
    const paymentDate = new Date().toLocaleString('id-ID');

    const alreadyPaid = paymentHistory.some(
      p => p.employeeId === employeeId && p.period === period
    );

    if (alreadyPaid) {
      alert(`Gaji untuk ${employeeName} periode ${period} sudah dibayar.`);
      return;
    }

    const bonusInput = window.prompt(`Masukkan jumlah bonus untuk ${employeeName} periode ${period} (kosongkan jika tidak ada bonus):`);
    let bonusAmount = parseFloat(bonusInput) || 0;
    bonusAmount = Math.round(bonusAmount);

    const totalAmountPaid = calculatedBaseSalary + bonusAmount;

    const newPaymentRecord = {
      id: `${employeeId}-${selectedMonth}-${selectedYear}`,
      employeeId: employeeId,
      employeeName: employeeName,
      period: period,
      baseSalary: calculatedBaseSalary - totalUangMakan,
      uangMakan: totalUangMakan,
      bonus: bonusAmount,
      amountPaid: totalAmountPaid,
      paymentDate: paymentDate,
    };

    setPaymentHistory(prevHistory => {
      const updatedHistory = [...prevHistory, newPaymentRecord];
      localStorage.setItem('salary_payment_history', JSON.stringify(updatedHistory));
      return updatedHistory;
    });

    alert(`Gaji Rp ${totalAmountPaid.toLocaleString('id-ID')} (termasuk bonus Rp ${bonusAmount.toLocaleString('id-ID')}) untuk ${employeeName} periode ${period} berhasil dibayar.`);
  };

  return (
    <div className="gaji-container">
      <h2>Pengelolaan Gaji Karyawan</h2>

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

      {loading && <p className="loading-message">Menghitung gaji...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && karyawanList.length === 0 && (
          <p className="info-message">Tidak ada karyawan di Master Data. Silakan tambahkan karyawan terlebih dahulu.</p>
      )}

      {!loading && !error && karyawanList.length > 0 && (
        <div className="employee-salary-list">
          {salaryData.length > 0 ? (
            salaryData.map(data => {
              const isPaid = paymentHistory.some(
                p => p.employeeId === data.employeeId && p.period === `${new Date(selectedYear, selectedMonth - 1).toLocaleString('id-ID', { month: 'long' })} ${selectedYear}`
              );
              
              return (
                <div key={data.employeeId} className="salary-card">
                  <h3>{data.namaLengkap}</h3>
                  <div className="salary-details">
                    <h4>Rincian Periode {new Date(selectedYear, selectedMonth - 1).toLocaleString('id-ID', { month: 'long' })} {selectedYear}:</h4>
                    <p>Gaji per Jam: <strong>Rp {(data.gajiPerJam ?? 0).toLocaleString('id-ID')}</strong></p>
                    <p>Uang Makan Harian: <strong>Rp {(data.uangMakanHarian ?? 0).toLocaleString('id-ID')}</strong></p>
                    <p>Total Jam Kerja Efektif: <strong>{data.totalWorkingDuration.hours} jam {data.totalWorkingDuration.minutes} menit</strong></p>
                    <p>Total Waktu Istirahat: <strong>{data.totalBreakDuration.hours} jam {data.totalBreakDuration.minutes} menit</strong></p>
                    <p>Pekerjaan Selesai: <strong>{data.totalCompletedJobs}</strong></p>
                    <p>Hari Hadir (Tercatat Jam Masuk/Pulang): <strong>{data.totalDaysPresent} hari</strong></p>
                    <p>Hari Absen (Tercatat Absen): <strong>{data.totalDaysAbsent} hari</strong></p>
                  </div>
                  <div className="salary-summary">
                    <p>Gaji Pokok (Berdasarkan Jam Kerja): <strong>Rp {(data.gajiBersihDihitung - (data.totalUangMakan ?? 0)).toLocaleString('id-ID')}</strong></p>
                    <p>Total Uang Makan: <strong>Rp {(data.totalUangMakan ?? 0).toLocaleString('id-ID')}</strong></p>
                    <p className="net-salary">Total Gaji Dihitung: <strong>Rp {(data.gajiBersihDihitung ?? 0).toLocaleString('id-ID')}</strong></p>
                  </div>
                  <button
                    className="btn-pay-salary"
                    onClick={() => handlePaySalary(data.employeeId, data.namaLengkap, data.gajiBersihDihitung, data.totalUangMakan ?? 0)}
                    disabled={isPaid || loading}
                  >
                    {isPaid ? 'Sudah Dibayar' : 'Bayar Gaji'}
                  </button>
                </div>
              );
            })
          ) : (
            <p className="no-salary-data">Tidak ada data gaji untuk periode ini.</p>
          )}
        </div>
      )}

      <hr className="divider" />

      <div className="payment-history-section">
        <h3>Riwayat Pembayaran Gaji</h3>
        {paymentHistory.length > 0 ? (
          <table className="payment-history-table">
            <thead>
              <tr>
                <th>Nama Karyawan</th>
                <th>Periode</th>
                <th>Gaji Pokok</th>
                <th>Uang Makan</th>
                <th>Bonus</th>
                <th>Total Dibayar</th>
                <th>Tanggal Pembayaran</th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.map((record) => (
                <tr key={record.id}>
                  <td>{record.employeeName}</td>
                  <td>{record.period}</td>
                  <td>Rp {(record.baseSalary ?? 0).toLocaleString('id-ID')}</td>
                  <td>Rp {(record.uangMakan ?? 0).toLocaleString('id-ID')}</td>
                  <td>Rp {(record.bonus ?? 0).toLocaleString('id-ID')}</td>
                  <td>Rp {(record.amountPaid ?? 0).toLocaleString('id-ID')}</td>
                  <td>{record.paymentDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-payment-history">Belum ada riwayat pembayaran gaji.</p>
        )}
      </div>
    </div>
  );
};

export default Gaji;
