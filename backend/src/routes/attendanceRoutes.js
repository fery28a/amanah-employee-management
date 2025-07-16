// backend/src/routes/attendanceRoutes.js
const express = require('express');
const {
  getAttendanceByEmployeeAndDate,
  updateOrCreateAttendance,
  getAttendanceByDate,
  getAttendanceByMonth, // Import fungsi baru
} = require('../controllers/attendanceController');

const router = express.Router();

// --- PENTING: Urutan rute di sini sangat krusial untuk mencegah konflik ---

// 1. Route untuk mendapatkan absensi semua karyawan pada tanggal tertentu (untuk Monitoring/Absensi massal)
//    Menggunakan '/bydate/:date' agar tidak ambigu dengan '/:employeeId/:date'
router.get('/bydate/:date', getAttendanceByDate);

// 2. Route untuk mendapatkan absensi semua karyawan berdasarkan bulan & tahun
//    Letakkan ini di atas rute yang lebih umum seperti /:employeeId/:date jika patternnya serupa
router.get('/bymonth/:year/:month', getAttendanceByMonth);

// 3. Route untuk mendapatkan absensi per karyawan per tanggal (paling umum)
//    Harus di bawah rute yang lebih spesifik seperti /bydate atau /bymonth
router.get('/:employeeId/:date', getAttendanceByEmployeeAndDate);

// 4. Route untuk mengupdate atau membuat absensi (POST request, tidak ada konflik URL)
router.post('/update', updateOrCreateAttendance);


module.exports = router;