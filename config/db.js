const mongoose = require('mongoose');

const connectDB = async (uri) => {
  try {
    await mongoose.connect(uri);
    console.log("DB connected");
  } catch (e) {
    console.error('MongoDB connection error:', e);
    throw e;
  }
};

module.exports = connectDB;
