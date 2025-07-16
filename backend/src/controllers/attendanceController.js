// backend/src/controllers/attendanceController.js
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee'); // Diperlukan untuk validasi employeeId

// @desc    Mendapatkan absensi untuk karyawan tertentu pada tanggal tertentu
// @route   GET /api/attendance/:employeeId/:date
// @access  Public
const getAttendanceByEmployeeAndDate = async (req, res) => {
  try {
    const { employeeId, date } = req.params;
    console.log(`[Backend] Memproses permintaan absensi tunggal untuk Karyawan: ${employeeId}, Tanggal: ${date}`);
    const attendance = await Attendance.findOne({ employee: employeeId, date: date });

    if (attendance) {
      res.json(attendance);
    } else {
      // Jika tidak ada absensi, kirim objek default agar frontend mudah menanganinya
      res.status(200).json({
        employee: employeeId, // Kirim ID karyawan yang diminta
        date: date,
        status: 'Belum Absen',
        pekerjaan: [],
        totalIstirahatDurasi: 0,
        jamMasuk: null,
        jamPulang: null,
        jamIstirahatMulai: null,
      });
    }
  } catch (error) {
    console.error(`[Backend ERROR] di getAttendanceByEmployeeAndDate: ${error.message}`);
    // Perbaikan: Jika cast ObjectId gagal, itu berarti ID tidak valid, bukan error server
    if (error.name === 'CastError' && error.path === 'employee') {
      return res.status(400).json({ message: 'ID Karyawan tidak valid.' });
    }
    res.status(500).json({ message: error.message || "Internal Server Error." });
  }
};

// @desc    Mengupdate/membuat absensi karyawan (upsert)
// @route   POST /api/attendance/update
// @access  Public
const updateOrCreateAttendance = async (req, res) => {
  const { employeeId, date, status, jamMasuk, jamPulang, jamIstirahatMulai, totalIstirahatDurasi, pekerjaan } = req.body;

  // Validasi dasar
  if (!employeeId || !date || !status) {
    return res.status(400).json({ message: 'Employee ID, tanggal, dan status harus diisi.' });
  }

  try {
    // Pastikan karyawan ada
    const employeeExists = await Employee.findById(employeeId);
    if (!employeeExists) {
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }

    // Temukan dan perbarui, atau buat baru jika tidak ada (upsert)
    const attendance = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: date }, // Query untuk mencari
      { // Data yang akan diupdate/diset
        status,
        jamMasuk: jamMasuk || null,
        jamPulang: jamPulang || null,
        jamIstirahatMulai: jamIstirahatMulai || null,
        totalIstirahatDurasi: totalIstirahatDurasi || 0,
        pekerjaan: pekerjaan || [], // Pastikan ini selalu array
      },
      {
        new: true, // Mengembalikan dokumen yang diperbarui
        upsert: true, // Membuat dokumen baru jika tidak ditemukan
        setDefaultsOnInsert: true // Menerapkan nilai default pada dokumen baru
      }
    ).populate('employee', 'namaLengkap gajiPerJam'); // Populasi kembali setelah update/create

    res.status(200).json(attendance);
  } catch (error) {
    console.error(`[Backend ERROR] di updateOrCreateAttendance: ${error.message}`);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Mendapatkan absensi untuk semua karyawan pada tanggal tertentu (untuk Monitoring & Absensi massal)
// @route   GET /api/attendance/bydate/:date
// @access  Public
const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    console.log(`[Backend] Memproses permintaan absensi untuk semua karyawan pada tanggal: ${date}`);

    const allEmployees = await Employee.find({}, '_id namaLengkap gajiPerJam');
    console.log(`[Backend] Ditemukan ${allEmployees.length} karyawan di database.`);

    const attendances = await Attendance.find({ date: date }).populate({
      path: 'employee',
      select: 'namaLengkap gajiPerJam',
    });
    console.log(`[Backend] Ditemukan ${attendances.length} catatan absensi untuk tanggal ${date}.`);

    const result = allEmployees.map(employee => {
      if (!employee || !employee._id) {
        console.warn(`[Backend WARNING] Objek karyawan tidak valid:`, employee);
        return null;
      }

      const existingAttendance = attendances.find(att =>
        att.employee && att.employee._id && att.employee._id.equals(employee._id)
      );

      let finalAttendanceData;

      if (existingAttendance) {
        finalAttendanceData = existingAttendance.toObject();
        // Fallback jika populate gagal (misal employee ID di Attendance tidak ada lagi di Employee)
        if (!finalAttendanceData.employee) {
            console.warn(`[Backend WARNING] Catatan absensi ditemukan untuk ID Karyawan ${employee._id} tetapi data karyawan kosong setelah populasi. Menggunakan data karyawan fallback.`);
            finalAttendanceData.employee = {
                _id: employee._id,
                namaLengkap: employee.namaLengkap,
                gajiPerJam: employee.gajiPerJam,
            };
        }
      } else {
        finalAttendanceData = {
          employee: {
            _id: employee._id,
            namaLengkap: employee.namaLengkap,
            gajiPerJam: employee.gajiPerJam,
          },
          date: date,
          status: 'Belum Absen',
          pekerjaan: [],
          totalIstirahatDurasi: 0,
          jamMasuk: null,
          jamPulang: null,
          jamIstirahatMulai: null,
        };
      }
      return finalAttendanceData;
    }).filter(item => item !== null);

    console.log(`[Backend] Berhasil menyiapkan ${result.length} catatan absensi untuk respon.`);
    res.json(result);
  } catch (error) {
    console.error(`[Backend CRITICAL ERROR] di getAttendanceByDate:`, error);
    res.status(500).json({ message: error.message || "Internal Server Error. Periksa log server untuk detail." });
  }
};

// @desc    Mendapatkan semua catatan absensi untuk bulan dan tahun tertentu (untuk Gaji & Laporan)
// @route   GET /api/attendance/bymonth/:year/:month
// @access  Public
const getAttendanceByMonth = async (req, res) => {
    try {
        const { year, month } = req.params;
        console.log(`[Backend] Memproses permintaan absensi untuk bulan: ${month}, tahun: ${year}`);

        // Pastikan input year dan month adalah angka valid
        const parsedYear = parseInt(year);
        const parsedMonth = parseInt(month);
        if (isNaN(parsedYear) || isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
            return res.status(400).json({ message: 'Tahun dan bulan harus angka valid (1-12).' });
        }

        // Query berdasarkan string tanggal YYYY-MM-DD
        const startDateString = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-01`;
        const endDateObj = new Date(parsedYear, parsedMonth, 0); // Last day of the month (Date object)
        const endDateString = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;

        console.log(`[Backend] Mencari absensi dari ${startDateString} sampai ${endDateString}`);

        const attendances = await Attendance.find({
            date: {
                $gte: startDateString,
                $lte: endDateString
            }
        }).populate('employee', 'namaLengkap gajiPerJam'); // Populasi data karyawan

        console.log(`[Backend] Ditemukan ${attendances.length} catatan absensi untuk bulan ${month}/${year}.`);

        res.json(attendances);

    } catch (error) {
        console.error(`[Backend CRITICAL ERROR] di getAttendanceByMonth:`, error);
        res.status(500).json({ message: error.message || "Internal Server Error. Periksa log server untuk detail." });
    }
};

// Pastikan semua fungsi diekspor dengan benar
module.exports = {
  getAttendanceByEmployeeAndDate,
  updateOrCreateAttendance,
  getAttendanceByDate,
  getAttendanceByMonth, // Tambahkan fungsi baru di exports
};