const Review = require('../models/review.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const { ApiError } = require('../middleware/error.middleware');

/**
 * Create a new review
 * @route POST /api/reviews
 * @access Private
 */
const createReview = async (req, res, next) => {
  try {
    const { product, rating, title, comment, images } = req.body;
    
    // Check if product exists
    const productExists = await Product.findById(product);
    if (!productExists) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      user: req.user._id,
      product
    });
    
    if (existingReview) {
      throw new ApiError(400, 'You have already reviewed this product');
    }
    
    // Check if user has purchased the product
    const isVerifiedPurchase = await Review.checkVerifiedPurchase(req.user._id, product);
    
    // Create review
    const review = new Review({
      user: req.user._id,
      product,
      rating,
      title,
      comment,
      images: images || [],
      isVerifiedPurchase,
      // Auto-approve reviews from verified purchases
      isApproved: isVerifiedPurchase
    });
    
    await review.save();
    
    // Update product rating
    await productExists.updateRating();
    
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get reviews for a product
 * @route GET /api/reviews/product/:productId
 * @access Public
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc',
      rating
    } = req.query;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Build filter object
    const filter = {
      product: productId,
      isApproved: true
    };
    
    // Filter by rating if provided
    if (rating) {
      filter.rating = Number(rating);
    }
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build sort object
    const sortOptions = {};
    
    // Sort by helpful (likes) if requested
    if (sortBy === 'helpful') {
      sortOptions['likes.count'] = order === 'asc' ? 1 : -1;
    } else {
      sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    }
    
    // Add secondary sort by date
    if (sortBy !== 'createdAt') {
      sortOptions.createdAt = -1;
    }
    
    // Get reviews
    const reviews = await Review.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name');
    
    // Get total count for pagination
    const totalReviews = await Review.countDocuments(filter);
    
    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { product: product._id, isApproved: true } },
      { $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);
    
    // Format rating distribution
    const formattedDistribution = {
      5: 0, 4: 0, 3: 0, 2: 0, 1: 0
    };
    
    ratingDistribution.forEach(item => {
      formattedDistribution[item._id] = item.count;
    });
    
    res.status(200).json({
      success: true,
      count: reviews.length,
      total: totalReviews,
      totalPages: Math.ceil(totalReviews / Number(limit)),
      currentPage: Number(page),
      ratingDistribution: formattedDistribution,
      reviews
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single review
 * @route GET /api/reviews/:id
 * @access Public
 */
const getReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find review
    const review = await Review.findById(id)
      .populate('user', 'name')
      .populate('product', 'name slug images');
    
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    // Check if review is approved or belongs to the current user
    if (!review.isApproved && (!req.user || review.user._id.toString() !== req.user._id.toString()) && (!req.user || req.user.role !== 'admin')) {
      throw new ApiError(403, 'Review is pending approval');
    }
    
    res.status(200).json({
      success: true,
      review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a review
 * @route PUT /api/reviews/:id
 * @access Private
 */
const updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;
    
    // Find review
    const review = await Review.findById(id);
    
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    // Check if review belongs to the current user
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new ApiError(403, 'Not authorized to update this review');
    }
    
    // Update review fields
    if (rating) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment) review.comment = comment;
    if (images) review.images = images;
    
    // If updated by user (not admin), reset approval for non-verified purchases
    if (req.user.role !== 'admin' && !review.isVerifiedPurchase) {
      review.isApproved = false;
    }
    
    await review.save();
    
    // Update product rating
    const product = await Product.findById(review.product);
    await product.updateRating();
    
    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a review
 * @route DELETE /api/reviews/:id
 * @access Private
 */
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find review
    const review = await Review.findById(id);
    
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    // Check if review belongs to the current user or user is admin
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new ApiError(403, 'Not authorized to delete this review');
    }
    
    // Delete review
    await review.remove();
    
    // Update product rating
    const product = await Product.findById(review.product);
    await product.updateRating();
    
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Like a review
 * @route POST /api/reviews/:id/like
 * @access Private
 */
const likeReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find review
    const review = await Review.findById(id);
    
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    // Check if review is approved
    if (!review.isApproved) {
      throw new ApiError(400, 'Cannot like a pending review');
    }
    
    // Add like
    await review.addLike(req.user._id);
    
    res.status(200).json({
      success: true,
      message: 'Review liked successfully',
      likes: review.likes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unlike a review
 * @route DELETE /api/reviews/:id/like
 * @access Private
 */
const unlikeReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find review
    const review = await Review.findById(id);
    
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    // Remove like
    await review.removeLike(req.user._id);
    
    res.status(200).json({
      success: true,
      message: 'Review unliked successfully',
      likes: review.likes
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all reviews
 * @route GET /api/reviews/admin/all
 * @access Private (Admin only)
 */
const getAllReviews = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc',
      approved,
      verified,
      product,
      rating
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Filter by approval status
    if (approved !== undefined) {
      filter.isApproved = approved === 'true';
    }
    
    // Filter by verified purchase
    if (verified !== undefined) {
      filter.isVerifiedPurchase = verified === 'true';
    }
    
    // Filter by product
    if (product) {
      filter.product = product;
    }
    
    // Filter by rating
    if (rating) {
      filter.rating = Number(rating);
    }
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    
    // Get reviews
    const reviews = await Review.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name email')
      .populate('product', 'name slug');
    
    // Get total count for pagination
    const totalReviews = await Review.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      count: reviews.length,
      total: totalReviews,
      totalPages: Math.ceil(totalReviews / Number(limit)),
      currentPage: Number(page),
      reviews
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Approve a review
 * @route PUT /api/reviews/:id/approve
 * @access Private (Admin only)
 */
const approveReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find review
    const review = await Review.findById(id);
    
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    // Update approval status
    review.isApproved = true;
    await review.save();
    
    // Update product rating
    const product = await Product.findById(review.product);
    await product.updateRating();
    
    res.status(200).json({
      success: true,
      message: 'Review approved successfully',
      review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Respond to a review
 * @route POST /api/reviews/:id/respond
 * @access Private (Admin only)
 */
const respondToReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    
    // Find review
    const review = await Review.findById(id);
    
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    // Add/update response
    if (review.response) {
      await review.updateResponse(comment, req.user._id);
    } else {
      await review.addResponse(comment, req.user._id);
    }
    
    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      review
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getReview,
  updateReview,
  deleteReview,
  likeReview,
  unlikeReview,
  getAllReviews,
  approveReview,
  respondToReview
};