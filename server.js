require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('passport');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const userRoutes = require('./routes/user.routes');
const orderRoutes = require('./routes/order.routes');
const categoryRoutes = require('./routes/category.routes');
const reviewRoutes = require('./routes/review.routes');

// Import middleware
const { notFound, errorHandler } = require('./middleware/error.middleware');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
require('./config/db.config');

// Configure passport
require('./config/passport.config');

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Middleware
app.use(helmet()); // Set security-related HTTP headers
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use('/api', apiLimiter); // Apply rate limiting to all API routes

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/reviews', reviewRoutes);

// Swagger documentation configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'E-commerce API',
      version: '1.0.0',
      description: 'A RESTful API for an e-commerce platform with OAuth 2.0 authentication',
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'User ID' },
            name: { type: 'string', description: 'User full name' },
            email: { type: 'string', description: 'User email address' },
            role: { type: 'string', enum: ['customer', 'admin'], description: 'User role' },
            // Add other user properties here
          }
        },
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Product ID' },
            name: { type: 'string', description: 'Product name' },
            description: { type: 'string', description: 'Product description' },
            price: { type: 'number', description: 'Product price' },
            // Add other product properties here
          }
        },
        Category: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Category ID' },
            name: { type: 'string', description: 'Category name' },
            slug: { type: 'string', description: 'URL-friendly version of name' },
            // Add other category properties here
          }
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Order ID' },
            orderNumber: { type: 'string', description: 'Unique order number' },
            status: { type: 'string', description: 'Order status' },
            // Add other order properties here
          }
        },
        Review: {
          type: 'object',
          properties: {
            _id: { type: 'string', description: 'Review ID' },
            product: { type: 'string', description: 'Product ID' },
            rating: { type: 'number', description: 'Rating (1-5)' },
            // Add other review properties here
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js'], // Point to your route files
};

// Generate Swagger documentation
const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Add manual path definitions for important endpoints
// This ensures some endpoints are documented even without JSDoc in route files
swaggerDocs.paths = {
  ...swaggerDocs.paths,
  '/auth/register': {
    post: {
      tags: ['Authentication'],
      summary: 'Register a new user',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'email', 'password', 'method'],
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                password: { type: 'string' },
                method: { type: 'string', enum: ['local'] }
              }
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'User registered successfully'
        }
      }
    }
  },
  '/auth/login': {
    post: {
      tags: ['Authentication'],
      summary: 'Login with email and password',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string' },
                password: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Login successful'
        }
      }
    }
  },
  '/products': {
    get: {
      tags: ['Products'],
      summary: 'Get all products',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer' }, description: 'Page number' },
        { name: 'limit', in: 'query', schema: { type: 'integer' }, description: 'Items per page' },
        { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category ID' }
      ],
      responses: {
        '200': {
          description: 'List of products'
        }
      }
    },
    post: {
      tags: ['Products'],
      summary: 'Create a new product',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name', 'description', 'price', 'sku', 'inventory', 'categories'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                price: { type: 'number' },
                sku: { type: 'string' },
                inventory: {
                  type: 'object',
                  properties: {
                    quantity: { type: 'integer' }
                  }
                },
                categories: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Product created successfully'
        }
      }
    }
  },
  '/categories': {
    get: {
      tags: ['Categories'],
      summary: 'Get all categories',
      responses: {
        '200': {
          description: 'List of categories'
        }
      }
    },
    post: {
      tags: ['Categories'],
      summary: 'Create a new category',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Category created successfully'
        }
      }
    }
  },
  '/orders': {
    get: {
      tags: ['Orders'],
      summary: 'Get all orders for current user',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'List of orders'
        }
      }
    },
    post: {
      tags: ['Orders'],
      summary: 'Create a new order',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['items', 'billing', 'shipping', 'payment'],
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      product: { type: 'string' },
                      quantity: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        '201': {
          description: 'Order created successfully'
        }
      }
    }
  }
};

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Welcome to the E-commerce API',
    documentation: '/api-docs'
  });
});

// Error middleware should be last
app.use(notFound);  // Handle 404 errors for unmatched routes
app.use(errorHandler);  // Handle all errors

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// For testing purposes
module.exports = app;