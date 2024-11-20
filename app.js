const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const authRoutes = require('./routes/authRoute');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const investmentsRoutes = require('./routes/investmentRoute');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Define allowed origins array
const allowedOrigins = [
  'https://localhost:3000',
  'https://koinfest.org',
  'https://app.koinfest.org',
  'https://www.koinfest.org',
  'https://www.app.koinfest.org',
  'https://koinfest-dashboard.vercel.app',
  'http://localhost:3000'
];

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check if the origin matches any of our allowed origins
    const isAllowedOrigin = allowedOrigins.some(allowedOrigin => origin === allowedOrigin) ||
      // Check for Vercel preview URLs
      origin.endsWith('.vercel.app') ||
      // Check for koinfest.org subdomains
      origin.endsWith('.koinfest.org');

    if (isAllowedOrigin) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin); // Helpful for debugging
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Access-Token'
  ],
  exposedHeaders: ['Authorization'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security headers with updated CSP
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: [
        "'self'",
        "https://*.koinfest.org",
        "https://*.vercel.app",
        ...allowedOrigins
      ],
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true
}));

// Ensure uploads directory exists
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Add production logging if needed
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: 'Too many requests from this IP, please try again in an hour!',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to API routes
app.use('/api', limiter);

// Special rate limit for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/auth/login', authLimiter);

// Health check endpoint with basic server info
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/investments', investmentsRoutes);

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
const gracefulShutdown = () => {
  console.log('👋 Graceful shutdown initiated.');
  // Add any cleanup operations here (e.g., closing database connections)
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export the app
module.exports = app;