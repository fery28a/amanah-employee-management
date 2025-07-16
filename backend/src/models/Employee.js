// backend/src/models/Employee.js
const mongoose = require('mongoose');

const EmployeeSchema = mongoose.Schema(
  {
    namaLengkap: {
      type: String,
      required: true,
    },
    alamat: {
      type: String,
      required: true,
    },
    nomorTelepon: {
      type: String,
      required: true,
    },
    gajiPerJam: {
      type: Number,
      required: true,
      default: 0, // Default value jika tidak diisi
    },
    // --- TAMBAHAN BARU: UANG MAKAN HARIAN ---
    uangMakanHarian: {
      type: Number,
      required: true,
      default: 0, // Default value jika tidak diisi
    },
    // ---------------------------------------
  },
  {
    timestamps: true, // Otomatis menambahkan createdAt dan updatedAt
  }
);

module.exports = mongoose.model('Employee', EmployeeSchema);