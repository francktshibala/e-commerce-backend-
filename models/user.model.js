const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in query results by default
  },
  role: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'customer'
  },
  method: {
    type: String,
    enum: ['local', 'google'],
    required: true
  },
  google: {
    id: String,
    name: String,
    email: String,
    picture: String
  },
  phone: {
    type: String,
    trim: true
  },
  addresses: [{
    name: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  cart: {
    items: [{
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      price: {
        type: Number,
        required: true
      }
    }],
    totalPrice: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  const user = this;
  
  // Only hash the password if it's modified (or new)
  if (!user.isModified('password')) return next();
  
  // Skip if using OAuth
  if (user.method !== 'local') return next();
  
  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash password
    const hashedPassword = await bcrypt.hash(user.password, salt);
    
    // Replace plain text password with hashed one
    user.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if password is correct
userSchema.methods.isValidPassword = async function(password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    throw new Error(error);
  }
};

// Method to add item to cart
userSchema.methods.addToCart = function(product, quantity) {
  const cartProductIndex = this.cart.items.findIndex(item => {
    return item.productId.toString() === product._id.toString();
  });
  
  const updatedCartItems = [...this.cart.items];
  let newQuantity = quantity || 1;
  
  if (cartProductIndex >= 0) {
    // If product already exists in cart, update quantity
    newQuantity = this.cart.items[cartProductIndex].quantity + newQuantity;
    updatedCartItems[cartProductIndex].quantity = newQuantity;
    updatedCartItems[cartProductIndex].price = product.price;
  } else {
    // Add new product to cart
    updatedCartItems.push({
      productId: product._id,
      quantity: newQuantity,
      price: product.price
    });
  }
  
  // Calculate total price
  const totalPrice = updatedCartItems.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  
  // Update cart
  this.cart = {
    items: updatedCartItems,
    totalPrice: totalPrice
  };
  
  return this.save();
};

// Method to remove item from cart
userSchema.methods.removeFromCart = function(productId) {
  const updatedCartItems = this.cart.items.filter(item => {
    return item.productId.toString() !== productId.toString();
  });
  
  // Calculate total price
  const totalPrice = updatedCartItems.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  
  // Update cart
  this.cart = {
    items: updatedCartItems,
    totalPrice: totalPrice
  };
  
  return this.save();
};

// Method to clear cart
userSchema.methods.clearCart = function() {
  this.cart = { items: [], totalPrice: 0 };
  return this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;