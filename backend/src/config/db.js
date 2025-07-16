// backend/src/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,      // Opsi untuk menghindari deprecation warnings
      useUnifiedTopology: true,   // Opsi untuk menghindari deprecation warnings
      // useCreateIndex: true,    // Dihapus di Mongoose 6
      // useFindAndModify: false  // Dihapus di Mongoose 6
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Keluar dari proses dengan kode error
  }
};

module.exports = connectDB;