const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import database connection
const connectDB = require('./config/db');

// Import scheduled jobs service
const { initializeScheduledJobs } = require('./services/scheduledJobsService');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const policyRoutes = require('./routes/policyRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const advancedAnalyticsRoutes = require('./routes/advancedAnalyticsRoutes');
const handoverRoutes = require('./routes/handoverRoutes');
const intentRoutes = require('./routes/intentRoutes');
const taskRoutes = require('./routes/taskRoutes');
const projectRoutes = require('./routes/projectRoutes');
const hierarchyRoutes = require('./routes/hierarchyRoutes');
const salaryRoutes = require('./routes/salaryRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const planningRoutes = require('./routes/planningRoutes');
const collaborationRoutes = require('./routes/collaborationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const fileRoutes = require('./routes/fileRoutes');
const peopleRoutes = require('./routes/peopleRoutes');
const governanceRoutes = require('./routes/governanceRoutes');
const auditRoutes = require('./routes/auditRoutes');
const accountSecurityRoutes = require('./routes/accountSecurityRoutes');
const userPreferencesRoutes = require('./routes/userPreferencesRoutes');
const privacyRoutes = require('./routes/privacyRoutes');

// Initialize express
const app = express();

// Connect to MongoDB (skip automatic connect in test environment)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Middleware
const developmentOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV !== 'production' || origin === process.env.FRONTEND_URL || developmentOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many auth attempts from this IP. Please try again in 15 minutes.'
  }
});

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// Routes
app.use('/api/auth', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/analytics', advancedAnalyticsRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/intents', intentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/api/salary', salaryRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/account-security', accountSecurityRoutes);
app.use('/api/user-preferences', userPreferencesRoutes);
app.use('/api/privacy', privacyRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      error: 'Duplicate field value entered'
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: errors.join(', ')
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired'
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server (only in non-test environments)
let server;
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    // Initialize scheduled jobs after server starts
    initializeScheduledJobs();
  });

  // Handle port already in use error
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' || error.errno === -4091) {
      console.error(`\n❌ Port ${PORT} is already in use!`);
      console.error('\n💡 Solutions:');
      console.error('   1. Run: npm run clean (to kill existing processes)');
      console.error('   2. Run: npm run kill-port (to free the port)');
      console.error('   3. Or manually kill node processes in Task Manager');
      console.error('\n   Then restart the server.\n');
      process.exit(1);
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });
}

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Closing HTTP server and MongoDB connection...`);
  const closeDatabase = async () => {
    try {
      await mongoose.connection.close();
      console.log('Server and MongoDB connection closed');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  if (!server) {
    await closeDatabase();
    return;
  }

  server.close(closeDatabase);
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
