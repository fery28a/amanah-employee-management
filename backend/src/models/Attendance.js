// backend/src/models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Employee', // Referensi ke model Employee
    },
    date: {
      type: String, // Format YYYY-MM-DD
      required: true,
    },
    status: {
      type: String,
      enum: ['Belum Absen', 'Hadir', 'Absen', 'Istirahat'],
      default: 'Belum Absen',
    },
    jamMasuk: {
      type: Date, // Waktu masuk
      default: null,
    },
    jamPulang: {
      type: Date, // Waktu pulang
      default: null,
    },
    jamIstirahatMulai: {
      type: Date, // Waktu mulai istirahat terakhir
      default: null,
    },
    totalIstirahatDurasi: {
      type: Number, // Akumulasi durasi istirahat dalam milidetik
      default: 0,
    },
    pekerjaan: [ // Array of objects untuk menyimpan daftar pekerjaan
      {
        text: {
          type: String,
          trim: true,
        },
        completed: {
          type: Boolean,
          default: false,
        },
        completionTime: {
          type: Date, // Waktu pekerjaan diselesaikan
          default: null,
        }
      }
    ],
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Membuat index unik untuk mencegah duplikasi absensi per karyawan per tanggal
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });


const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;