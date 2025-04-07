const { validationResult, body, param, query } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  next();
};

/**
 * Validators for user-related routes
 */
const userValidators = {
  // Validate user registration data
  register: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
    
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    
    handleValidationErrors
  ],
  
  // Validate login data
  login: [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('password')
      .notEmpty().withMessage('Password is required'),
    
    handleValidationErrors
  ],
  
  // Validate address data
  address: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required'),
    
    body('street')
      .trim()
      .notEmpty().withMessage('Street address is required'),
    
    body('city')
      .trim()
      .notEmpty().withMessage('City is required'),
    
    body('state')
      .trim()
      .notEmpty().withMessage('State is required'),
    
    body('zipCode')
      .trim()
      .notEmpty().withMessage('Zip code is required'),
    
    body('country')
      .trim()
      .notEmpty().withMessage('Country is required'),
    
    handleValidationErrors
  ]
};

/**
 * Validators for product-related routes
 */
const productValidators = {
  // Validate product creation/update data
  createProduct: [
    body('name')
      .trim()
      .notEmpty().withMessage('Product name is required')
      .isLength({ max: 100 }).withMessage('Product name cannot exceed 100 characters'),
    
    body('description')
      .trim()
      .notEmpty().withMessage('Product description is required'),
    
    body('price')
      .isNumeric().withMessage('Price must be a number')
      .isFloat({ min: 0 }).withMessage('Price cannot be negative'),
    
    body('inventory.quantity')
      .isInt({ min: 0 }).withMessage('Inventory quantity must be a non-negative integer'),
    
    body('categories')
      .isArray().withMessage('Categories must be an array')
      .notEmpty().withMessage('At least one category is required'),
    
    body('sku')
      .trim()
      .notEmpty().withMessage('SKU is required'),
    
    handleValidationErrors
  ],
  
  // Validate product ID
  productId: [
    param('id')
      .isMongoId().withMessage('Invalid product ID'),
    
    handleValidationErrors
  ]
};

/**
 * Validators for order-related routes
 */
const orderValidators = {
  // Validate order creation data
  createOrder: [
    body('items')
      .isArray().withMessage('Items must be an array')
      .notEmpty().withMessage('At least one item is required'),
    
    body('items.*.product')
      .isMongoId().withMessage('Invalid product ID'),
    
    body('items.*.quantity')
      .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    
    body('billing.name')
      .trim()
      .notEmpty().withMessage('Billing name is required'),
    
    body('billing.email')
      .trim()
      .notEmpty().withMessage('Billing email is required')
      .isEmail().withMessage('Invalid billing email format'),
    
    body('billing.address.street')
      .trim()
      .notEmpty().withMessage('Billing street is required'),
    
    body('billing.address.city')
      .trim()
      .notEmpty().withMessage('Billing city is required'),
    
    body('billing.address.state')
      .trim()
      .notEmpty().withMessage('Billing state is required'),
    
    body('billing.address.zipCode')
      .trim()
      .notEmpty().withMessage('Billing zip code is required'),
    
    body('billing.address.country')
      .trim()
      .notEmpty().withMessage('Billing country is required'),
    
    body('shipping.name')
      .trim()
      .notEmpty().withMessage('Shipping name is required'),
    
    body('shipping.address.street')
      .trim()
      .notEmpty().withMessage('Shipping street is required'),
    
    body('shipping.address.city')
      .trim()
      .notEmpty().withMessage('Shipping city is required'),
    
    body('shipping.address.state')
      .trim()
      .notEmpty().withMessage('Shipping state is required'),
    
    body('shipping.address.zipCode')
      .trim()
      .notEmpty().withMessage('Shipping zip code is required'),
    
    body('shipping.address.country')
      .trim()
      .notEmpty().withMessage('Shipping country is required'),
    
    body('payment.method')
      .isIn(['credit_card', 'paypal', 'stripe', 'bank_transfer'])
      .withMessage('Invalid payment method'),
    
    handleValidationErrors
  ],
  
  // Validate order ID
  orderId: [
    param('id')
      .isMongoId().withMessage('Invalid order ID'),
    
    handleValidationErrors
  ]
};

/**
 * Validators for review-related routes
 */
const reviewValidators = {
  // Validate review creation data
  createReview: [
    body('product')
      .isMongoId().withMessage('Invalid product ID'),
    
    body('rating')
      .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    
    body('comment')
      .trim()
      .notEmpty().withMessage('Review comment is required'),
    
    handleValidationErrors
  ],
  
  // Validate review ID
  reviewId: [
    param('id')
      .isMongoId().withMessage('Invalid review ID'),
    
    handleValidationErrors
  ]
};

/**
 * Validators for category-related routes
 */
const categoryValidators = {
  // Validate category creation/update data
  createCategory: [
    body('name')
      .trim()
      .notEmpty().withMessage('Category name is required'),
    
    body('slug')
      .trim()
      .notEmpty().withMessage('Category slug is required')
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Slug must be URL-friendly'),
    
    body('parent')
      .optional()
      .isMongoId().withMessage('Invalid parent category ID'),
    
    handleValidationErrors
  ],
  
  // Validate category ID
  categoryId: [
    param('id')
      .isMongoId().withMessage('Invalid category ID'),
    
    handleValidationErrors
  ]
};

/**
 * Common validators for pagination and filtering
 */
const commonValidators = {
  // Validate pagination parameters
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    
    handleValidationErrors
  ],
  
  // Validate sorting parameters
  sorting: [
    query('sortBy')
      .optional()
      .isString().withMessage('Sort field must be a string'),
    
    query('order')
      .optional()
      .isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  userValidators,
  productValidators,
  orderValidators,
  reviewValidators,
  categoryValidators,
  commonValidators
};