const express = require('express');
const app = express();
require('dotenv').config();

// Import middleware
const configureCors = require('./middleware/cors');
const configureHelmet = require('./middleware/helmet');
const configureRateLimit = require('./middleware/rateLimit');

// Import MongoDB connection
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const usersProfile = require('./routes/auth')

// Apply middleware
app.use(express.json());
app.use(configureCors());
app.use(configureHelmet());
app.use(configureRateLimit());

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users',usersProfile)

// Fallback port if PORT is not defined
const port = process.env.PORT;

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
})();