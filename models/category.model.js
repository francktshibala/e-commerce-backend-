const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true
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
    trim: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  ancestors: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      required: true
    }
  }],
  image: {
    url: String,
    alt: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  level: {
    type: Number,
    default: 0
  },
  order: {
    type: Number,
    default: 0
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

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Virtual for products in this category
categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'categories'
});

// Pre-save middleware to update ancestors and level
categorySchema.pre('save', async function(next) {
  try {
    // Skip if parent hasn't changed
    if (!this.isModified('parent')) return next();
    
    // Root category (no parent)
    if (!this.parent) {
      this.ancestors = [];
      this.level = 0;
      return next();
    }
    
    // Find parent category
    const parentCategory = await this.constructor.findById(this.parent);
    if (!parentCategory) {
      return next(new Error('Parent category not found'));
    }
    
    // Update ancestors array
    this.ancestors = [
      ...parentCategory.ancestors,
      {
        _id: parentCategory._id,
        name: parentCategory.name,
        slug: parentCategory.slug
      }
    ];
    
    // Update level based on ancestors count
    this.level = this.ancestors.length;
    
    next();
  } catch (error) {
    next(error);
  }
});

// Create indexes
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ name: 'text', description: 'text' });

// Static method to get category tree
categorySchema.statics.getTree = async function() {
  const categories = await this.find().sort({ order: 1 });
  
  const categoryMap = {};
  const rootCategories = [];
  
  // Create a map for quick lookup
  categories.forEach(category => {
    categoryMap[category._id] = {
      ...category.toObject(),
      children: []
    };
  });
  
  // Build the tree
  categories.forEach(category => {
    if (category.parent) {
      // Has parent, add to parent's children
      if (categoryMap[category.parent]) {
        categoryMap[category.parent].children.push(categoryMap[category._id]);
      }
    } else {
      // No parent, add to root categories
      rootCategories.push(categoryMap[category._id]);
    }
  });
  
  return rootCategories;
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;