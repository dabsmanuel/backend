//middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SuperAdmin = require('../models/SuperAdmin');

// Middleware to verify JWT token and authenticate user
exports.authMiddleware = async (req, res, next) => {
  try {
      let token;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
          token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
          return res.status(401).json({ message: 'Access denied. No token provided.' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Now verify if the user exists in SuperAdmin or User model based on decoded role
      let user;
      if (decoded.role === 'superadmin') {
          user = await SuperAdmin.findById(decoded.id);
      } else {
          user = await User.findById(decoded.id);
      }

      if (!user) {
          return res.status(401).json({ message: 'Access denied. User does not exist.' });
      }

      req.user = user;
      next();
  } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({ message: 'Invalid token. Please log in again.' });
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
