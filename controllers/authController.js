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


// Generate a random 6-digit code
const generateResetCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Request password reset
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide your email address'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'No user found with this email address'
      });
    }

    // Generate a 6-digit reset code
    const resetCode = generateResetCode();
    const resetCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Hash the reset code before saving
    const hashedResetCode = crypto
      .createHash('sha256')
      .update(resetCode)
      .digest('hex');

    // Save the hashed reset code and expiration
    user.passwordResetCode = hashedResetCode;
    user.passwordResetExpires = resetCodeExpires;
    await user.save({ validateBeforeSave: false });

    // TODO: Send the reset code via email
    // In production, you would use a proper email service here
    console.log(`Reset code for ${email}: ${resetCode}`);

    res.status(200).json({
      status: 'success',
      message: 'Password reset code has been sent to your email',
      // Only include this in development
      devOnly: {
        resetCode
      }
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500).json({
      status: 'error',
      message: 'There was an error sending the password reset code. Please try again later.'
    });
  }
};

// Reset password with code
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, resetCode, newPassword } = req.body;

    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email, reset code, and new password'
      });
    }

    // Hash the provided reset code for comparison
    const hashedResetCode = crypto
      .createHash('sha256')
      .update(resetCode)
      .digest('hex');

    // Find user with matching reset code that hasn't expired
    const user = await User.findOne({
      email,
      passwordResetCode: hashedResetCode,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid or expired reset code'
      });
    }

    // Update password and clear reset fields
    user.password = newPassword;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Generate new JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully',
      token
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      status: 'error',
      message: 'There was an error resetting your password. Please try again later.'
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
