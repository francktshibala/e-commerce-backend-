/**
 * Custom error class for API errors
 */
class ApiError extends Error {
    constructor(statusCode, message, errors = []) {
      super(message);
      this.statusCode = statusCode;
      this.errors = errors;
      this.isOperational = true;
      
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Handle 404 errors
   */
  const notFound = (req, res, next) => {
    const error = new ApiError(404, `Not Found - ${req.originalUrl}`);
    next(error);
  };
  
  /**
   * Global error handler middleware
   */
  const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    console.error(err);
    
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || [];
    
    // Handle MongoDB validation errors
    if (err.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation Error';
      errors = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message
      }));
    }
    
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      statusCode = 400;
      message = 'Duplicate field value entered';
      
      const field = Object.keys(err.keyValue)[0];
      errors = [{
        field,
        message: `${field} already exists`
      }];
    }
    
    // Handle MongoDB cast errors (invalid ID)
    if (err.name === 'CastError') {
      statusCode = 400;
      message = `Invalid ${err.path}: ${err.value}`;
    }
    
    // Send JSON response
    res.status(statusCode).json({
      success: false,
      message,
      errors: errors.length ? errors : undefined,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  };
  
  module.exports = {
    ApiError,
    notFound,
    errorHandler,
    // Export as default middleware for use in server.js
    errorMiddleware: (req, res, next) => {
      notFound(req, res, next);
      errorHandler(req, res, next);
    }
  };