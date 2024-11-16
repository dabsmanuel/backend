//middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SuperAdmin = require('../models/SuperAdmin');

// Middleware to verify JWT token and authenticate user
exports.authMiddleware = async (req, res, next) => {
    try {
      // Check for token in headers
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          status: 'fail',
          message: 'No authentication token provided'
        });
      }
  
      // Verify token
      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          status: 'fail',
          message: 'Invalid or expired token'
        });
      }
  
      // Check if user exists
      let user;
      if (decoded.role === 'superadmin') {
        user = await SuperAdmin.findById(decoded.id);
      } else {
        user = await User.findById(decoded.id);
      }
  
      if (!user) {
        return res.status(401).json({
          status: 'fail',
          message: 'User no longer exists'
        });
      }
  
      // Add user to request
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error during authentication'
      });
    }
  };


// Middleware to restrict access based on role
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};
