//controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const SuperAdmin = require('../models/SuperAdmin');
const nodemailer = require('nodemailer');


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

    if (!name || !email || !mobileNumber || !country || !city || !gender || !dateOfBirth || !password) {
      return res.status(400).json({ 
        message: 'Please provide all required fields' 
      });
    }
      const existingUser = await User.findOne({ email });
      if (existingUser) {
          return res.status(400).json({ message: 'Email already exists. Please try logging in.' });
      }

      const newUser = await User.create({ name, 
        email, 
        mobileNumber, 
        country, 
        city, 
        gender, 
        dateOfBirth, 
        password, role: 'user' });
      const token = signToken(newUser._id);

      res.status(201).json({
       status: 'success', 
       token, 
       data: { user: newUser } 
      });
  } catch (error) {
      next(error);
  }
};


// Regular User Login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email }); // Log login attempt

    // Find user and explicitly select password
    const user = await User.findOne({ email, role: 'user' }).select('+password');

    if (!user) {
      console.log('No user found with email:', email);
      return res.status(401).json({ message: 'No user found with this email' });
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      console.log('Password incorrect for email:', email);
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const token = signToken(user._id);
    res.status(200).json({ 
      status: 'success', 
      token, 
      data: { 
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        } 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'An error occurred during login', 
      error: error.message 
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


const transporter = nodemailer.createTransport({
  service: 'gmail',  // or any other email service
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Helper function to send email
const sendPasswordResetEmail = async (email, resetCode) => {
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject: 'Password Reset Code',
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested to reset your password. Here is your reset code:</p>
      <h2 style="color: #4a90e2; font-size: 24px; letter-spacing: 2px;">${resetCode}</h2>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  };

  return await transporter.sendMail(mailOptions);
};

// Version 1: With Email Verification
exports.forgotPasswordWithEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide your email address'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'No user found with this email address'
      });
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Save reset code and expiration
    user.passwordResetCode = resetCode;
    user.passwordResetExpires = resetCodeExpires;
    await user.save({ validateBeforeSave: false });

    // Send email
    await sendPasswordResetEmail(email, resetCode);

    res.status(200).json({
      status: 'success',
      message: 'Password reset code has been sent to your email'
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      status: 'error',
      message: 'There was an error sending the reset code. Please try again later.'
    });
  }
};