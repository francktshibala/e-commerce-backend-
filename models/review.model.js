const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true
  },
  images: [{
    url: String,
    alt: String
  }],
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  likes: {
    count: {
      type: Number,
      default: 0
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  response: {
    comment: String,
    createdAt: Date,
    updatedAt: Date,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Compound index to ensure a user can only review a product once
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Middleware to update product rating when review is added/modified/removed
reviewSchema.post('save', async function() {
  try {
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.product);
    if (product) {
      await product.updateRating();
    }
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
});

reviewSchema.post('remove', async function() {
  try {
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.product);
    if (product) {
      await product.updateRating();
    }
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
});

// Static method to check if user has purchased the product
reviewSchema.statics.checkVerifiedPurchase = async function(userId, productId) {
  const Order = mongoose.model('Order');
  
  const order = await Order.findOne({
    user: userId,
    'items.product': productId,
    status: { $in: ['shipped', 'delivered'] }
  });
  
  return !!order;
};

// Method to add like to review
reviewSchema.methods.addLike = async function(userId) {
  // Check if user already liked this review
  if (this.likes.users.includes(userId)) {
    return this;
  }
  
  // Add user to likes
  this.likes.users.push(userId);
  this.likes.count = this.likes.users.length;
  
  return this.save();
};

// Method to remove like from review
reviewSchema.methods.removeLike = async function(userId) {
  // Check if user already liked this review
  if (!this.likes.users.includes(userId)) {
    return this;
  }
  
  // Remove user from likes
  this.likes.users = this.likes.users.filter(id => id.toString() !== userId.toString());
  this.likes.count = this.likes.users.length;
  
  return this.save();
};

// Method to add admin response
reviewSchema.methods.addResponse = async function(comment, userId) {
  this.response = {
    comment,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: userId
  };
  
  return this.save();
};

// Method to update admin response
reviewSchema.methods.updateResponse = async function(comment, userId) {
  this.response.comment = comment;
  this.response.updatedAt = new Date();
  this.response.user = userId;
  
  return this.save();
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;