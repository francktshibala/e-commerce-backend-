# E-commerce API

A complete RESTful API for an e-commerce platform with OAuth 2.0 authentication, MongoDB database, and comprehensive features.

## Features

- **Authentication & Authorization**
  - OAuth 2.0 with Google authentication
  - JWT token-based session management
  - Role-based access control (customer, admin)
  - Password hashing with bcrypt

- **User Management**
  - User registration and login
  - Profile management
  - Address management
  - Cart functionality

- **Product Management**
  - Full CRUD operations for products
  - Product categorization
  - Search, filtering, and sorting
  - Inventory tracking

- **Order Processing**
  - Cart to order conversion
  - Multiple payment methods
  - Order status tracking
  - Order history

- **Review System**
  - Product ratings and reviews
  - Verified purchase badges
  - Helpful votes for reviews
  - Admin moderation

- **Security Features**
  - Input validation
  - CORS configuration
  - Rate limiting
  - Error handling

## Technology Stack

- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **Passport** - Authentication middleware
- **JWT** - JSON Web Tokens for authentication
- **bcrypt** - Password hashing
- **Express Validator** - Input validation
- **Swagger** - API documentation

## Getting Started

### Prerequisites

- Node.js (>=14.x)
- MongoDB instance
- Google OAuth credentials

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/e-commerce-api.git
   cd e-commerce-api
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Set up environment variables
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/ecommercedb
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=1d
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   FRONTEND_URL=http://localhost:3000
   ```

4. Start the server
   ```
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

5. Access the API documentation at `http://localhost:5000/api-docs`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update user profile
- `POST /api/auth/change-password` - Change password

### Products

- `GET /api/products` - Get all products (with filtering, sorting, pagination)
- `GET /api/products/:idOrSlug` - Get a single product
- `POST /api/products` - Create a product (admin)
- `PUT /api/products/:id` - Update a product (admin)
- `DELETE /api/products/:id` - Delete a product (admin)
- `GET /api/products/categories` - Get product categories
- `GET /api/products/brands` - Get product brands
- `GET /api/products/:id/related` - Get related products

### Categories

- `GET /api/categories` - Get all categories
- `GET /api/categories/:idOrSlug` - Get a single category
- `GET /api/categories/:idOrSlug/products` - Get products in a category
- `POST /api/categories` - Create a category (admin)
- `PUT /api/categories/:id` - Update a category (admin)
- `DELETE /api/categories/:id` - Delete a category (admin)

### Orders

- `POST /api/orders` - Create a new order
- `GET /api/orders` - Get all orders for current user
- `GET /api/orders/:id` - Get a single order
- `POST /api/orders/:id/cancel` - Cancel an order
- `GET /api/orders/admin/all` - Get all orders (admin)
- `GET /api/orders/admin/stats` - Get order statistics (admin)
- `PUT /api/orders/:id/status` - Update order status (admin)
- `PUT /api/orders/:id/payment` - Update payment status (admin)

### Reviews

- `GET /api/reviews/product/:productId` - Get reviews for a product
- `GET /api/reviews/:id` - Get a single review
- `POST /api/reviews` - Create a review
- `PUT /api/reviews/:id` - Update a review
- `DELETE /api/reviews/:id` - Delete a review
- `POST /api/reviews/:id/like` - Like a review
- `DELETE /api/reviews/:id/like` - Unlike a review
- `GET /api/reviews/admin/all` - Get all reviews (admin)
- `PUT /api/reviews/:id/approve` - Approve a review (admin)
- `POST /api/reviews/:id/respond` - Respond to a review (admin)

### Users (Admin)

- `GET /api/users` - Get all users
- `GET /api/users/stats` - Get user statistics
- `GET /api/users/:id` - Get a single user
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user
- `GET /api/users/:id/orders` - Get user orders

## Error Handling

The API includes comprehensive error handling with appropriate status codes and error messages. All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "fieldName",
      "message": "Field-specific error message"
    }
  ]
}
```

## Security Considerations

- All passwords are hashed using bcrypt
- JWT tokens expire after a configured period
- Rate limiting to prevent brute force attacks
- Input validation to prevent injection attacks
- CORS configured to restrict access to the API
- Role-based access control for protected routes
- Sensitive data is not returned in responses

## Database Models

The application uses the following MongoDB models:

- **User**: Stores user accounts, addresses, and cart information
- **Product**: Stores product details, inventory, and metadata
- **Category**: Stores product categories with hierarchical support
- **Order**: Tracks purchases, shipping details, and payment status
- **Review**: Stores product ratings and comments

## Frontend Integration

The API is designed to work with any frontend framework. Key integration points:

1. **Authentication**: Store JWT token in localStorage or secure cookie
2. **Authorization**: Include token in Authorization header for API requests
3. **State Management**: Use JWT payload to determine user role for UI rendering
4. **Token Expiration**: Check expiration and redirect to login when needed
5. **Session State**: Call `/auth/me` endpoint to get detailed user information

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Express.js documentation
- MongoDB and Mongoose documentation
- Passport.js and OAuth 2.0 implementations
- JWT authentication best practices