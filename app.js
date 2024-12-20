const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const authRoutes = require('./routes/authRoute');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const investmentsRoutes = require('./routes/investmentRoute');
const errorHandler = require('./middleware/errorHandler');
const notificationRoutes = require('./routes/notificationRoutes');


const app = express();

const allowedOrigins = [
  'https://localhost:3000',
  'https://koinfest.org',
  'https://app.koinfest.org',
  'https://www.koinfest.org',
  'https://www.app.koinfest.org',
  'https://koinfest-dashboard.vercel.app',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`CORS error: Origin ${origin} not allowed`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Access-Token'
  ],
  exposedHeaders: ['Authorization']
};


app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", ...allowedOrigins],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https:", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));

// Request parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Data sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Static files serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/investments', investmentsRoutes);
const testRoute = require('./routes/testRoute');
app.use('/', testRoute);

app.post('/api/auth/resetPassword/:email', async (req, res) => {
  try {
      const { email } = req.params;
      const { newPassword } = req.body;

      // Find the user
      const user = await UserModel.findOne({ email });
      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      // Hash and update the password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
      console.error('Error during password reset:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

app.use('/api/notifications', notificationRoutes);

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Graceful shutdown initiated.');
  process.exit(0);
});

module.exports = app;