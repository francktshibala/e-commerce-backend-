const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  compareAtPrice: {
    type: Number,
    min: [0, 'Compare at price cannot be negative']
  },
  costPrice: {
    type: Number,
    min: [0, 'Cost price cannot be negative'],
    select: false // Only accessible to admins
  },
  sku: {
    type: String,
    required: [true, 'Product SKU is required'],
    unique: true,
    trim: true
  },
  inventory: {
    quantity: {
      type: Number,
      required: [true, 'Inventory quantity is required'],
      min: [0, 'Inventory cannot be negative']
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0
    },
    available: {
      type: Number,
      min: 0
    }
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    },
    isMain: {
      type: Boolean,
      default: false
    }
  }],
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  }],
  tags: [{
    type: String
  }],
  attributes: {
    type: Map,
    of: String
  },
  variants: [{
    name: String,
    sku: String,
    price: Number,
    inventory: Number,
    attributes: {
      type: Map,
      of: String
    }
  }],
  brand: {
    type: String,
    trim: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['g', 'kg', 'lb', 'oz'],
      default: 'g'
    }
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'in'],
      default: 'cm'
    }
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  seo: {
    title: String,
    description: String,
    keywords: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product'
});

// Pre-save hook to calculate available inventory
productSchema.pre('save', function(next) {
  this.inventory.available = Math.max(0, this.inventory.quantity - this.inventory.reserved);
  next();
});

// Index for search
productSchema.index({ 
  name: 'text', 
  description: 'text', 
  brand: 'text', 
  'tags': 'text' 
});

// Methods
productSchema.methods.updateRating = async function() {
  const Review = mongoose.model('Review');
  
  const result = await Review.aggregate([
    { $match: { product: this._id } },
    { $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  if (result.length > 0) {
    this.averageRating = parseFloat(result[0].averageRating.toFixed(1));
    this.reviewCount = result[0].count;
  } else {
    this.averageRating = 0;
    this.reviewCount = 0;
  }
  
  return this.save();
};

// Statics
productSchema.statics.findByCategory = function(categoryId) {
  return this.find({ categories: categoryId });
};

productSchema.statics.findInStock = function() {
  return this.find({ 'inventory.available': { $gt: 0 } });
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;