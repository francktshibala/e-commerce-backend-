const passport = require('passport');
const User = require('../models/user.model');
const { generateToken } = require('../config/jwt.config');
const { ApiError } = require('../middleware/error.middleware');

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(400, 'User with this email already exists');
    }
    
    // Get user count - if first user, make admin
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'customer';
    
    // Create new user
    const user = new User({
      name,
      email,
      password,
      method: 'local', // Local authentication
      role // Set to admin if first user
    });
    
    await user.save();
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Remove sensitive data
    const userData = user.toObject();
    delete userData.password;
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: userData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }
    
    // Check if user is using local authentication
    if (user.method !== 'local') {
      throw new ApiError(400, `Please use ${user.method} authentication`);
    }
    
    // Check if user is active
    if (!user.isActive) {
      throw new ApiError(403, 'Account is deactivated');
    }
    
    // Verify password
    const isMatch = await user.isValidPassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials');
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Update last login time
    user.lastLogin = new Date();
    await user.save();
    
    // Remove sensitive data
    const userData = user.toObject();
    delete userData.password;
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initiate Google OAuth authentication
 * @route GET /api/auth/google
 * @access Public
 */
const googleAuth = (req, res, next) => {
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next);
};

/**
 * Google OAuth callback
 * @route GET /api/auth/google/callback
 * @access Public
 */
const googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    try {
      if (err) {
        throw new ApiError(500, 'Authentication failed');
      }
      
      if (!user) {
        throw new ApiError(401, 'Authentication failed');
      }
      
      // Generate JWT token
      const token = generateToken(user);
      
      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      next(error);
    }
  })(req, res, next);
};

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
const getProfile = async (req, res, next) => {
  try {
    // Find user by ID
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/auth/me
 * @access Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    
    // Find user by ID
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Update user data
    if (name) user.name = name;
    if (phone) user.phone = phone;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 * @route POST /api/auth/change-password
 * @access Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Find user by ID with password
    const user = await User.findById(req.user._id).select('+password');
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Check if user is using local authentication
    if (user.method !== 'local') {
      throw new ApiError(400, `Password change not available for ${user.method} authentication`);
    }
    
    // Verify current password
    const isMatch = await user.isValidPassword(currentPassword);
    if (!isMatch) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add new address
 * @route POST /api/auth/addresses
 * @access Private
 */
const addAddress = async (req, res, next) => {
  try {
    const { name, street, city, state, zipCode, country, isDefault } = req.body;
    
    // Find user by ID
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Create new address
    const newAddress = {
      name,
      street,
      city,
      state,
      zipCode,
      country,
      isDefault: isDefault || false
    };
    
    // If this is the first address or set as default, update other addresses
    if (isDefault || user.addresses.length === 0) {
      user.addresses.forEach(address => {
        address.isDefault = false;
      });
      newAddress.isDefault = true;
    }
    
    // Add address to user
    user.addresses.push(newAddress);
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      addresses: user.addresses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update address
 * @route PUT /api/auth/addresses/:addressId
 * @access Private
 */
const updateAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const { name, street, city, state, zipCode, country, isDefault } = req.body;
    
    // Find user by ID
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Find address index
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    
    if (addressIndex === -1) {
      throw new ApiError(404, 'Address not found');
    }
    
    // Update address
    if (name) user.addresses[addressIndex].name = name;
    if (street) user.addresses[addressIndex].street = street;
    if (city) user.addresses[addressIndex].city = city;
    if (state) user.addresses[addressIndex].state = state;
    if (zipCode) user.addresses[addressIndex].zipCode = zipCode;
    if (country) user.addresses[addressIndex].country = country;
    
    // If setting as default, update other addresses
    if (isDefault && !user.addresses[addressIndex].isDefault) {
      user.addresses.forEach(address => {
        address.isDefault = false;
      });
      user.addresses[addressIndex].isDefault = true;
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      addresses: user.addresses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete address
 * @route DELETE /api/auth/addresses/:addressId
 * @access Private
 */
const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    
    // Find user by ID
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Find address
    const address = user.addresses.id(addressId);
    
    if (!address) {
      throw new ApiError(404, 'Address not found');
    }
    
    // Check if it's the default address
    const isDefault = address.isDefault;
    
    // Remove address
    address.remove();
    
    // If it was the default address, set a new default
    if (isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
      addresses: user.addresses
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  googleCallback,
  getProfile,
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress
};