// backend/src/routes/employeeRoutes.js
const express = require('express');
const {
  getEmployees,
  createEmployee, // <<< Pastikan impornya 'createEmployee'
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employeeController');

const router = express.Router();

router.route('/')
  .get(getEmployees)
  .post(createEmployee); // <<< Gunakan 'createEmployee' di sini

router.route('/:id')
  .get(getEmployeeById) // Jika ada route GET by ID
  .put(updateEmployee)
  .delete(deleteEmployee);

module.exports = router;