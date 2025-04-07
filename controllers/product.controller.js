const Product = require('../models/product.model');
const Category = require('../models/category.model');
const { ApiError } = require('../middleware/error.middleware');

/**
 * Create a new product
 * @route POST /api/products
 * @access Private (Admin only)
 */
const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      sku,
      inventory,
      categories,
      brand,
      attributes,
      variants,
      isPublished,
      isFeatured,
      weight,
      dimensions,
      seo
    } = req.body;
    
    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Check if slug already exists
    const existingProduct = await Product.findOne({ slug });
    if (existingProduct) {
      throw new ApiError(400, 'Product with this name already exists');
    }
    
    // Validate categories
    for (const categoryId of categories) {
      const category = await Category.findById(categoryId);
      if (!category) {
        throw new ApiError(400, `Category not found with ID: ${categoryId}`);
      }
    }
    
    // Create product
    const product = new Product({
      name,
      slug,
      description,
      price,
      sku,
      inventory: {
        ...inventory,
        available: inventory.quantity - (inventory.reserved || 0)
      },
      categories,
      brand,
      attributes: attributes || {},
      variants: variants || [],
      isPublished: isPublished !== undefined ? isPublished : false,
      isFeatured: isFeatured || false,
      weight,
      dimensions,
      seo
    });
    
    await product.save();
    
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all products with filters, pagination, and sorting
 * @route GET /api/products
 * @access Public
 */
const getProducts = async (req, res, next) => {
  try {
    // Destructure query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc',
      category,
      minPrice,
      maxPrice,
      inStock,
      search,
      brand,
      featured
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Category filter
    if (category) {
      filter.categories = category;
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    
    // In stock filter
    if (inStock === 'true') {
      filter['inventory.available'] = { $gt: 0 };
    }
    
    // Brand filter
    if (brand) {
      filter.brand = brand;
    }
    
    // Featured filter
    if (featured === 'true') {
      filter.isFeatured = true;
    }
    
    // Published filter (always apply for public API)
    filter.isPublished = true;
    
    // Text search
    let searchQuery = {};
    if (search) {
      searchQuery = { $text: { $search: search } };
    }
    
    // Combine filters
    const combinedFilter = { ...filter, ...searchQuery };
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    
    // Add score for text search
    if (search) {
      sortOptions.score = { $meta: 'textScore' };
    }
    
    // Execute query with pagination
    const products = await Product.find(combinedFilter)
      .select(search ? { score: { $meta: 'textScore' } } : {})
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .populate('categories', 'name slug');
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments(combinedFilter);
    
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

/**
 * Get a single product by ID or slug
 * @route GET /api/products/:idOrSlug
 * @access Public
 */
const getProduct = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    
    // Check if it's a valid ObjectId
    const isValidId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
    
    // Build query based on ID or slug
    const query = isValidId
      ? { _id: idOrSlug }
      : { slug: idOrSlug };
    
    // Find product
    const product = await Product.findOne({
      ...query,
      isPublished: true // Only published products for public API
    }).populate('categories', 'name slug');
    
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Get reviews (optional)
    const populatedProduct = await product.populate({
      path: 'reviews',
      options: { 
        sort: { createdAt: -1 },
        limit: 5
      },
      populate: {
        path: 'user',
        select: 'name'
      }
    });
    
    res.status(200).json({
      success: true,
      product: populatedProduct
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a product
 * @route PUT /api/products/:id
 * @access Private (Admin only)
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Find product
    const product = await Product.findById(id);
    
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Handle specific fields
    if (updates.name) {
      // Update slug if name changes
      updates.slug = updates.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Check if new slug conflicts with existing products
      const existingProduct = await Product.findOne({
        slug: updates.slug,
        _id: { $ne: id }
      });
      
      if (existingProduct) {
        throw new ApiError(400, 'Product with this name already exists');
      }
    }
    
    // Validate categories if provided
    if (updates.categories) {
      for (const categoryId of updates.categories) {
        const category = await Category.findById(categoryId);
        if (!category) {
          throw new ApiError(400, `Category not found with ID: ${categoryId}`);
        }
      }
    }
    
    // Update inventory available field if quantity or reserved changed
    if (updates.inventory) {
      const newQuantity = updates.inventory.quantity !== undefined
        ? updates.inventory.quantity
        : product.inventory.quantity;
        
      const newReserved = updates.inventory.reserved !== undefined
        ? updates.inventory.reserved
        : product.inventory.reserved;
        
      updates.inventory.available = Math.max(0, newQuantity - newReserved);
    }
    
    // Update product with all changes
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('categories', 'name slug');
    
    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a product
 * @route DELETE /api/products/:id
 * @access Private (Admin only)
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find product
    const product = await Product.findById(id);
    
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Delete product
    await product.remove();
    
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product categories
 * @route GET /api/products/categories
 * @access Public
 */
const getProductCategories = async (req, res, next) => {
  try {
    // Get distinct categories from published products
    const productCategories = await Product.distinct('categories', {
      isPublished: true
    });
    
    // Get category details
    const categories = await Category.find({
      _id: { $in: productCategories }
    }).select('name slug image');
    
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
 * Get product brands
 * @route GET /api/products/brands
 * @access Public
 */
const getProductBrands = async (req, res, next) => {
  try {
    // Get distinct brands from published products
    const brands = await Product.distinct('brand', {
      isPublished: true,
      brand: { $ne: null }
    });
    
    res.status(200).json({
      success: true,
      count: brands.length,
      brands
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get related products
 * @route GET /api/products/:id/related
 * @access Public
 */
const getRelatedProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;
    
    // Find product
    const product = await Product.findById(id);
    
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Find related products based on categories
    const relatedProducts = await Product.find({
      _id: { $ne: id },
      categories: { $in: product.categories },
      isPublished: true
    })
      .limit(Number(limit))
      .select('name slug price images inventory averageRating');
    
    res.status(200).json({
      success: true,
      count: relatedProducts.length,
      products: relatedProducts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all products (including unpublished)
 * @route GET /api/products/admin/all
 * @access Private (Admin only)
 */
const getAllProductsAdmin = async (req, res, next) => {
  try {
    // Destructure query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc',
      search,
      isPublished
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Published filter
    if (isPublished !== undefined) {
      filter.isPublished = isPublished === 'true';
    }
    
    // Text search
    let searchQuery = {};
    if (search) {
      searchQuery = { $text: { $search: search } };
    }
    
    // Combine filters
    const combinedFilter = { ...filter, ...searchQuery };
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    
    // Execute query with pagination
    const products = await Product.find(combinedFilter)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .populate('categories', 'name slug');
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments(combinedFilter);
    
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
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getProductCategories,
  getProductBrands,
  getRelatedProducts,
  getAllProductsAdmin
};