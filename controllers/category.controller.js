const Category = require('../models/category.model');
const Product = require('../models/product.model');
const { ApiError } = require('../middleware/error.middleware');

/**
 * Create a new category
 * @route POST /api/categories
 * @access Private (Admin only)
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description, parent, image, isActive, order, seo } = req.body;
    
    // Generate slug if not provided
    let { slug } = req.body;
    if (!slug) {
      slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    
    // Check if slug already exists
    const existingCategory = await Category.findOne({ slug });
    if (existingCategory) {
      throw new ApiError(400, 'Category with this slug already exists');
    }
    
    // Create category
    const category = new Category({
      name,
      slug,
      description,
      parent,
      image,
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0,
      seo
    });
    
    await category.save();
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all categories
 * @route GET /api/categories
 * @access Public
 */
const getCategories = async (req, res, next) => {
  try {
    const { tree, active } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Only active categories
    if (active === 'true') {
      filter.isActive = true;
    }
    
    // If tree format is requested, get the category tree
    if (tree === 'true') {
      let categories;
      
      if (Object.keys(filter).length > 0) {
        categories = await Category.find(filter).sort({ order: 1 });
        
        // Build tree manually
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
          if (category.parent && categoryMap[category.parent]) {
            // Has parent, add to parent's children
            categoryMap[category.parent].children.push(categoryMap[category._id]);
          } else {
            // No parent or parent not in filtered results, add to root
            rootCategories.push(categoryMap[category._id]);
          }
        });
        
        // Return the tree
        return res.status(200).json({
          success: true,
          count: rootCategories.length,
          categories: rootCategories
        });
      } else {
        // Use the built-in method for all categories
        const rootCategories = await Category.getTree();
        
        return res.status(200).json({
          success: true,
          count: rootCategories.length,
          categories: rootCategories
        });
      }
    }
    
    // Flat list of categories
    const categories = await Category.find(filter)
      .sort({ order: 1 })
      .populate('parent', 'name slug');
    
    res.status(200).json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single category by ID or slug
 * @route GET /api/categories/:idOrSlug
 * @access Public
 */
const getCategory = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    
    // Check if it's a valid ObjectId
    const isValidId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
    
    // Build query based on ID or slug
    const query = isValidId
      ? { _id: idOrSlug }
      : { slug: idOrSlug };
    
    // Find category
    const category = await Category.findOne(query)
      .populate('parent', 'name slug')
      .populate('subcategories', 'name slug image');
    
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    // Get products count
    const productsCount = await Product.countDocuments({
      categories: category._id,
      isPublished: true
    });
    
    res.status(200).json({
      success: true,
      category: {
        ...category.toObject(),
        productsCount
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a category
 * @route PUT /api/categories/:id
 * @access Private (Admin only)
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Find category
    const category = await Category.findById(id);
    
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    // Prevent circular parent reference
    if (updates.parent && updates.parent.toString() === id.toString()) {
      throw new ApiError(400, 'Category cannot be its own parent');
    }
    
    // Check if updated slug already exists
    if (updates.slug) {
      const existingCategory = await Category.findOne({
        slug: updates.slug,
        _id: { $ne: id }
      });
      
      if (existingCategory) {
        throw new ApiError(400, 'Category with this slug already exists');
      }
    }
    
    // Generate slug from name if provided without slug
    if (updates.name && !updates.slug) {
      updates.slug = updates.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
        
      // Check if generated slug already exists
      const existingCategory = await Category.findOne({
        slug: updates.slug,
        _id: { $ne: id }
      });
      
      if (existingCategory) {
        throw new ApiError(400, 'Category with this name already exists');
      }
    }
    
    // Update category with all changes
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('parent', 'name slug')
      .populate('subcategories', 'name slug image');
    
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      category: updatedCategory
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a category
 * @route DELETE /api/categories/:id
 * @access Private (Admin only)
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find category
    const category = await Category.findById(id);
    
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    // Check if category has subcategories
    const subcategories = await Category.find({ parent: id });
    
    if (subcategories.length > 0) {
      throw new ApiError(400, 'Cannot delete category with subcategories');
    }
    
    // Check if category has products
    const products = await Product.countDocuments({ categories: id });
    
    if (products > 0) {
      throw new ApiError(400, 'Cannot delete category with associated products');
    }
    
    // Delete category
    await category.remove();
    
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get products by category
 * @route GET /api/categories/:idOrSlug/products
 * @access Public
 */
const getCategoryProducts = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;
    
    // Check if it's a valid ObjectId
    const isValidId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
    
    // Build query based on ID or slug
    const query = isValidId
      ? { _id: idOrSlug }
      : { slug: idOrSlug };
    
    // Find category
    const category = await Category.findOne(query);
    
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    // Get all subcategories recursively
    const getSubcategoryIds = async (categoryId) => {
      const directSubcategories = await Category.find({ parent: categoryId });
      let allSubcategoryIds = [categoryId];
      
      for (const subcategory of directSubcategories) {
        const nestedIds = await getSubcategoryIds(subcategory._id);
        allSubcategoryIds = [...allSubcategoryIds, ...nestedIds];
      }
      
      return allSubcategoryIds;
    };
    
    // Get all category IDs including subcategories
    const categoryIds = await getSubcategoryIds(category._id);
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    
    // Get products
    const products = await Product.find({
      categories: { $in: categoryIds },
      isPublished: true
    })
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .select('name slug price images inventory averageRating');
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments({
      categories: { $in: categoryIds },
      isPublished: true
    });
    
    res.status(200).json({
      success: true,
      count: products.length,
      total: totalProducts,
      totalPages: Math.ceil(totalProducts / Number(limit)),
      currentPage: Number(page),
      products
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  getCategoryProducts
};