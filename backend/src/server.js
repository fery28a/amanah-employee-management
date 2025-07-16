// backend/src/server.js
require('dotenv').config(); // Memuat variabel lingkungan dari .env
const express = require('express');
const connectDB = require('./config/db'); // Import fungsi koneksi DB
const cors = require('cors'); // Untuk mengizinkan permintaan dari frontend React

// --- Import Routes (akan kita buat nanti) ---
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');

// Koneksi ke Database MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 5051;

// Middleware
app.use(cors()); // Mengizinkan semua origin. Di produksi, atur origin spesifik.
app.use(express.json()); // Body parser untuk JSON

// --- Routes (akan kita hubungkan) ---
app.use('/api/employees', employeeRoutes); // API untuk manajemen karyawan
app.use('/api/attendance', attendanceRoutes); // API untuk absensi

// Route dasar
app.get('/', (req, res) => {
  res.send('Amanah Backend API is running...');
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});