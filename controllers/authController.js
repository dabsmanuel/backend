//controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const SuperAdmin = require('../models/SuperAdmin');


const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
  });
};

exports.getMe = async (req, res, next) => {
    try {
        const userId = req.user._id; // req.user should already be set by authMiddleware
        
        // Find user by ID in either the SuperAdmin or User models
        const user = await SuperAdmin.findById(userId) || await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({
            status: 'success',
            user
        });
    } catch (error) {
        next(error);
    }
};

// Super Admin Signup
exports.signupSuperAdmin = async (req, res, next) => {
  try {
      const { name, email, password } = req.body;
      
      // Check if a super admin already exists with this email
      const existingSuperAdmin = await SuperAdmin.findOne({ email });
      if (existingSuperAdmin) {
          return res.status(400).json({ message: 'Email already exists. Please log in.' });
      }

      // Create new super admin with role automatically set to 'superadmin'
      const newSuperAdmin = await SuperAdmin.create({ name, email, password });
      
      const token = signToken(newSuperAdmin._id, newSuperAdmin.role);
      res.status(201).json({
          status: 'success',
          token,
          data: { superadmin: newSuperAdmin }
      });
  } catch (error) {
      next(error);
  }
};

// Super Admin Login
exports.loginSuperAdmin = async (req, res, next) => {
  try {
      const { email, password } = req.body;
      const superadmin = await SuperAdmin.findOne({ email }).select('+password');

      if (!superadmin || !(await superadmin.comparePassword(password))) {
          return res.status(401).json({ message: 'Incorrect email or password' });
      }

      const token = signToken(superadmin._id, superadmin.role);
      res.status(200).json({
          status: 'success',
          token,
          data: { superadmin: { id: superadmin._id, role: superadmin.role } }
      });
  } catch (error) {
      next(error);
  }
};

exports.signup = async (req, res, next) => {
  try {
    const { 
      name, 
      email, 
      mobileNumber, 
      country, 
      city, 
      gender, 
      dateOfBirth, 
      password 
    } = req.body;

    // Validate required fields
    if (!name || !email || !mobileNumber || !country || !city || !gender || !dateOfBirth || !password) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Please provide all required fields' 
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Email already exists. Please try logging in.' 
      });
    }

    // Create new user with plain text password
    const newUser = await User.create({
      name,
      email,
      mobileNumber,
      country,
      city,
      gender,
      dateOfBirth: new Date(dateOfBirth), // Ensure proper date format
      password, // Store password as plain text
      role: 'user'
    });

    // Generate token
    const token = signToken(newUser._id);

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      status: 'success',
      token,
      data: { 
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Signup error:', error); // Log the full error
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during signup',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }

    // Find user and explicitly select password
    const user = await User.findOne({ email, role: 'user' }).select('+password');

    if (!user) {
      console.log('No user found with email:', email);
      return res.status(401).json({
        status: 'error',
        message: 'No user found with this email'
      });
    }

    // Compare plain text passwords
    const isPasswordCorrect = password === user.password;
    
    if (!isPasswordCorrect) {
      console.log('Password incorrect for email:', email);
      return res.status(401).json({
        status: 'error',
        message: 'Incorrect password'
      });
    }

    const token = signToken(user._id);

    // Remove sensitive data from response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    res.status(200).json({ 
      status: 'success', 
      token,
      data: { 
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};


exports.changePassword = async (req, res, next) => {
  try {
      const { currentPassword, newPassword } = req.body;

      // Get current user from request (set by authMiddleware)
      const superAdmin = await SuperAdmin.findById(req.user._id).select('+password');

      if (!superAdmin) {
          return res.status(404).json({
              status: 'fail',
              message: 'User no longer exists'
          });
      }

      // Verify current password
      const isPasswordCorrect = await superAdmin.comparePassword(currentPassword);
      if (!isPasswordCorrect) {
          return res.status(401).json({
              status: 'fail',
              message: 'Current password is incorrect'
          });
      }

      // Update password
      superAdmin.password = newPassword;
      await superAdmin.save();

      // Generate new token
      const token = jwt.sign(
          { id: superAdmin._id, role: superAdmin.role },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      res.status(200).json({
          status: 'success',
          message: 'Password updated successfully',
          token // Send new token after password change
      });
  } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
          status: 'error',
          message: 'Error updating password'
      });
  }
};

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ message: 'You are not logged in! Please log in to get access.' });
    }
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({ message: 'The user belonging to this token no longer exists.' });
    }
    req.user = currentUser;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid token. Please log in again.' });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
          return res.status(403).json({ message: 'Access denied. You must be a super admin to view this page.' });
      }
      next();
  };
};


exports.forgotPassword = async (req, res, next) => {
  try {
      const { email } = req.body;

      // Check if user with this email exists
      const user = await User.findOne({ email });
      if (!user) {
          return res.status(404).json({ message: 'No user found with this email' });
      }

      // If email is valid, return a success response
      res.status(200).json({ message: 'Email verified. Proceed to reset your password.' });
  } catch (error) {
      next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await User.findOne({ email: req.params.email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.resetPassword(password);

    res.status(200).json({ 
      message: 'Password updated successfully. Please log in.' 
    });
  } catch (error) { 
    console.error('Reset password error:', error);
    res.status(500).json({ 
      message: 'Error resetting password', 
      errorDetails: error.message
    });
  }
};
