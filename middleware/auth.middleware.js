const passport = require('passport');
const { verifyToken } = require('../config/jwt.config');

/**
 * Middleware to authenticate JWT token and attach user to request
 */
const authenticateJWT = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or expired token'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }
    
    // Update last login time
    user.lastLogin = new Date();
    user.save().catch((err) => console.error('Error updating last login:', err));
    
    // Attach user to request
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Middleware to check if user is an admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: No authentication provided'
    });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Admin access required'
    });
  }
  
  next();
};

/**
 * Middleware to check if user is owner of the resource or admin
 * @param {Function} getOwnerId - Function to extract owner ID from request
 */
const isOwnerOrAdmin = (getOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: No authentication provided'
        });
      }
      
      // Admin can access any resource
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Get owner ID from request using callback
      const ownerId = await getOwnerId(req);
      
      // Check if user is the owner
      if (ownerId && ownerId.toString() === req.user._id.toString()) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to access this resource'
      });
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Parse authorization header if present
 * This middleware doesn't return an error if no token is provided,
 * useful for endpoints that work with or without authentication
 */
const parseAuthToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      
      if (decoded) {
        // Find user without throwing error if not found
        passport.authenticate('jwt', { session: false }, (err, user) => {
          if (user && user.isActive) {
            req.user = user;
          }
          next();
        })(req, res, next);
      } else {
        // Invalid token, but we continue without error
        next();
      }
    } else {
      // No token provided, continue
      next();
    }
  } catch (error) {
    // Error parsing token, continue without error
    next();
  }
};

module.exports = {
  authenticateJWT,
  isAdmin,
  isOwnerOrAdmin,
  parseAuthToken
};