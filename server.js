require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('passport');
const fs = require('fs');
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

// Load Swagger JSON file
let swaggerDocument;
try {
  swaggerDocument = JSON.parse(fs.readFileSync('./swagger.json', 'utf8'));
} catch (error) {
  console.error('Error loading swagger.json file:', error);
  // Fallback to a basic Swagger document if file not found
  swaggerDocument = {
    openapi: "3.0.3",
    info: {
      title: "E-Commerce API",
      description: "API documentation for the e-commerce backend with OAuth 2.0 authentication",
      version: "1.0.0"
    },
    servers: [
      {
        url: "http://localhost:5000/api",
        description: "Local server"
      }
    ],
    tags: [
      {
        name: "Authentication",
        description: "Authentication operations"
      },
      {
        name: "Products",
        description: "Product management"
      },
      {
        name: "Categories",
        description: "Category management"
      },
      {
        name: "Orders",
        description: "Order management"
      },
      {
        name: "Reviews",
        description: "Product review management"
      },
      {
        name: "Users",
        description: "User management (Admin only)"
      }
    ],
    paths: {
      "/orders/{id}/cancel": {
        "post": {
          "summary": "Cancel an order",
          "tags": ["Orders"],
          "security": [{ "bearerAuth": [] }],
          "parameters": [
            {
              "in": "path",
              "name": "id",
              "required": true,
              "schema": { "type": "string" }
            }
          ],
          "responses": {
            "200": {
              "description": "Order cancelled successfully",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "object",
                    "properties": {
                      "success": { "type": "boolean" },
                      "message": { "type": "string" }
                    }
                  }
                }
              }
            },
            "400": {
              "description": "Bad request",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/Error"
                  }
                }
              }
            },
            "404": {
              "description": "Order not found",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/Error"
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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