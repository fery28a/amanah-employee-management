// backend/src/controllers/employeeController.js
const Employee = require('../models/Employee');

// @desc    Mendapatkan semua karyawan
// @route   GET /api/employees
// @access  Public
const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({});
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Membuat karyawan baru
// @route   POST /api/employees
// @access  Public
const createEmployee = async (req, res) => {
  // Tambahkan uangMakanHarian ke destructuring
  const { namaLengkap, alamat, nomorTelepon, gajiPerJam, uangMakanHarian } = req.body;

  if (!namaLengkap || !alamat || !nomorTelepon || gajiPerJam === undefined || uangMakanHarian === undefined) {
    return res.status(400).json({ message: 'Semua field harus diisi.' });
  }

  try {
    const employee = await Employee.create({
      namaLengkap,
      alamat,
      nomorTelepon,
      gajiPerJam,
      uangMakanHarian, // Tambahkan ini
    });
    res.status(201).json(employee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Mendapatkan karyawan berdasarkan ID
// @route   GET /api/employees/:id
// @access  Public
const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (employee) {
      res.json(employee);
    } else {
      res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Memperbarui karyawan
// @route   PUT /api/employees/:id
// @access  Public
const updateEmployee = async (req, res) => {
  // Tambahkan uangMakanHarian ke destructuring
  const { namaLengkap, alamat, nomorTelepon, gajiPerJam, uangMakanHarian } = req.body;

  try {
    const employee = await Employee.findById(req.params.id);

    if (employee) {
      employee.namaLengkap = namaLengkap ?? employee.namaLengkap;
      employee.alamat = alamat ?? employee.alamat;
      employee.nomorTelepon = nomorTelepon ?? employee.nomorTelepon;
      employee.gajiPerJam = gajiPerJam ?? employee.gajiPerJam;
      employee.uangMakanHarian = uangMakanHarian ?? employee.uangMakanHarian; // Tambahkan ini

      const updatedEmployee = await employee.save();
      res.json(updatedEmployee);
    } else {
      res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Menghapus karyawan
// @route   DELETE /api/employees/:id
// @access  Public
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (employee) {
      await Employee.deleteOne({ _id: req.params.id }); // Menggunakan deleteOne
      res.json({ message: 'Karyawan berhasil dihapus.' });
    } else {
      res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEmployees,
  createEmployee,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};