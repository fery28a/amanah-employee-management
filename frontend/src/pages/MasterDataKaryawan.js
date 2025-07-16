// frontend/src/pages/MasterData.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MasterDataKaryawan.css';
const API_BASE_URL = 'http://10.10.10.100:5001/api';

const MasterData = () => {
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);

  const [namaLengkap, setNamaLengkap] = useState('');
  const [alamat, setAlamat] = useState('');
  const [nomorTelepon, setNomorTelepon] = useState('');
  const [gajiPerJam, setGajiPerJam] = useState('');
  // --- TAMBAHAN BARU: UANG MAKAN HARIAN ---
  const [uangMakanHarian, setUangMakanHarian] = useState('');
  // ---------------------------------------

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/employees`);
      setEmployees(response.data);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError('Gagal memuat data karyawan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const resetForm = () => {
    setNamaLengkap('');
    setAlamat('');
    setNomorTelepon('');
    setGajiPerJam('');
    setUangMakanHarian(''); // Reset juga uang makan harian
    setCurrentEmployeeId(null);
    setIsEditMode(false);
    setError(null);
    setSuccessMessage(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (employee) => {
    setNamaLengkap(employee.namaLengkap);
    setAlamat(employee.alamat);
    setNomorTelepon(employee.nomorTelepon);
    setGajiPerJam(employee.gajiPerJam);
    setUangMakanHarian(employee.uangMakanHarian); // Set juga uang makan harian
    setCurrentEmployeeId(employee._id);
    setIsEditMode(true);
    setIsModalOpen(true);
    setError(null);
    setSuccessMessage(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const employeeData = {
      namaLengkap,
      alamat,
      nomorTelepon,
      gajiPerJam: parseFloat(gajiPerJam), // Pastikan ini angka
      uangMakanHarian: parseFloat(uangMakanHarian), // Pastikan ini angka
    };

    try {
      if (isEditMode) {
        await axios.put(`${API_BASE_URL}/employees/${currentEmployeeId}`, employeeData);
        setSuccessMessage('Data karyawan berhasil diperbarui!');
      } else {
        await axios.post(`${API_BASE_URL}/employees`, employeeData);
        setSuccessMessage('Karyawan baru berhasil ditambahkan!');
      }
      fetchEmployees(); // Refresh list
      closeModal();
    } catch (err) {
      console.error('Error submitting employee data:', err.response?.data || err);
      setError(err.response?.data?.message || 'Gagal menyimpan data karyawan.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus karyawan ini?')) {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        await axios.delete(`${API_BASE_URL}/employees/${id}`);
        setSuccessMessage('Karyawan berhasil dihapus!');
        fetchEmployees(); // Refresh list
      } catch (err) {
        console.error('Error deleting employee:', err.response?.data || err);
        setError(err.response?.data?.message || 'Gagal menghapus karyawan.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="master-data-container">
      <h2>Master Data Karyawan</h2>

      <button className="btn-add-employee" onClick={openAddModal}>
        Tambah Karyawan Baru
      </button>

      {loading && <p className="loading-message">Memuat data...</p>}
      {error && <p className="error-message">{error}</p>}
      {successMessage && <p className="success-message">{successMessage}</p>}

      {!loading && employees.length === 0 && !error && (
        <p className="info-message">Belum ada data karyawan. Silakan tambahkan karyawan baru.</p>
      )}

      {!loading && employees.length > 0 && (
        <div className="employee-list">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Nama Lengkap</th>
                <th>Alamat</th>
                <th>No. Telepon</th>
                <th>Gaji per Jam</th>
                <th>Uang Makan Harian</th> {/* Tambahkan header */}
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee, index) => (
                <tr key={employee._id}>
                  <td>{index + 1}</td>
                  <td>{employee.namaLengkap}</td>
                  <td>{employee.alamat}</td>
                  <td>{employee.nomorTelepon}</td>
                  <td>Rp {employee.gajiPerJam.toLocaleString('id-ID')}</td>
                  <td>Rp {employee.uangMakanHarian.toLocaleString('id-ID')}</td> {/* Tampilkan data */}
                  <td className="actions">
                    <button className="btn-edit" onClick={() => openEditModal(employee)}>
                      Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(employee._id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{isEditMode ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="namaLengkap">Nama Lengkap:</label>
                <input
                  type="text"
                  id="namaLengkap"
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="alamat">Alamat:</label>
                <input
                  type="text"
                  id="alamat"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="nomorTelepon">Nomor Telepon:</label>
                <input
                  type="text"
                  id="nomorTelepon"
                  value={nomorTelepon}
                  onChange={(e) => setNomorTelepon(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="gajiPerJam">Gaji per Jam:</label>
                <input
                  type="number"
                  id="gajiPerJam"
                  value={gajiPerJam}
                  onChange={(e) => setGajiPerJam(e.target.value)}
                  required
                  min="0"
                  step="any"
                  disabled={loading}
                />
              </div>
              {/* --- INPUT BARU: UANG MAKAN HARIAN --- */}
              <div className="form-group">
                <label htmlFor="uangMakanHarian">Uang Makan Harian:</label>
                <input
                  type="number"
                  id="uangMakanHarian"
                  value={uangMakanHarian}
                  onChange={(e) => setUangMakanHarian(e.target.value)}
                  required
                  min="0"
                  step="any"
                  disabled={loading}
                />
              </div>
              {/* ------------------------------------ */}
              {error && <p className="error-message">{error}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn-save" disabled={loading}>
                  {loading ? 'Menyimpan...' : (isEditMode ? 'Simpan Perubahan' : 'Tambah')}
                </button>
                <button type="button" className="btn-cancel" onClick={closeModal} disabled={loading}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterData;