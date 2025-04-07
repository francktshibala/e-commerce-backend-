const User = require('../models/user.model');
const Order = require('../models/order.model');
const Review = require('../models/review.model');
const { ApiError } = require('../middleware/error.middleware');

/**
 * Admin: Get all users
 * @route GET /api/users
 * @access Private (Admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc',
      search,
      role,
      active
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Filter by role
    if (role) {
      filter.role = role;
    }
    
    // Filter by active status
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }
    
    // Search by name or email
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    
    // Get users
    const users = await User.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .select('-password -cart');
    
    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      count: users.length,
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / Number(limit)),
      currentPage: Number(page),
      users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get a single user
 * @route GET /api/users/:id
 * @access Private (Admin only)
 */
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find user
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Get user statistics
    const orderCount = await Order.countDocuments({ user: id });
    const reviewCount = await Review.countDocuments({ user: id });
    
    // Get latest orders
    const latestOrders = await Order.find({ user: id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderNumber createdAt total status');
    
    res.status(200).json({
      success: true,
      user,
      stats: {
        orderCount,
        reviewCount
      },
      latestOrders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update a user
 * @route PUT /api/users/:id
 * @access Private (Admin only)
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;
    
    // Find user
    const user = await User.findById(id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Prevent changing own role (admin can't demote themselves)
    if (id === req.user._id.toString() && role && role !== user.role) {
      throw new ApiError(400, 'You cannot change your own role');
    }
    
    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    
    await user.save();
    
    // Remove sensitive data
    const userData = user.toObject();
    delete userData.password;
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: userData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete a user
 * @route DELETE /api/users/:id
 * @access Private (Admin only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting own account
    if (id === req.user._id.toString()) {
      throw new ApiError(400, 'You cannot delete your own account');
    }
    
    // Find user
    const user = await User.findById(id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Check if user has orders
    const hasOrders = await Order.exists({ user: id });
    
    if (hasOrders) {
      // Instead of deleting, just deactivate the account
      user.isActive = false;
      await user.save();
      
      return res.status(200).json({
        success: true,
        message: 'User has orders. Account has been deactivated instead of deleted.'
      });
    }
    
    // Delete user's reviews
    await Review.deleteMany({ user: id });
    
    // Delete user
    await user.remove();
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get user orders
 * @route GET /api/users/:id/orders
 * @access Private (Admin only)
 */
const getUserOrders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 10,
      status
    } = req.query;
    
    // Check if user exists
    const user = await User.findById(id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Build filter object
    const filter = { user: id };
    
    // Filter by status if provided
    if (status) {
      filter.status = status;
    }
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Get orders
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    // Get total count for pagination
    const totalOrders = await Order.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      count: orders.length,
      total: totalOrders,
      totalPages: Math.ceil(totalOrders / Number(limit)),
      currentPage: Number(page),
      orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get customer statistics
 * @route GET /api/users/stats
 * @access Private (Admin only)
 */
const getUserStats = async (req, res, next) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments();
    
    // Get new users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const newUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Get user role distribution
    const roleDistribution = await User.aggregate([
      { $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format role distribution
    const formattedRoleDistribution = {};
    roleDistribution.forEach(item => {
      formattedRoleDistribution[item._id] = item.count;
    });
    
    // Get active vs inactive users
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = totalUsers - activeUsers;
    
    // Get top customers by order value
    const topCustomers = await Order.aggregate([
      { $match: { status: { $nin: ['cancelled', 'refunded'] } } },
      { $group: {
          _id: '$user',
          totalSpent: { $sum: '$total' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      { $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      { $project: {
          _id: 1,
          totalSpent: 1,
          orderCount: 1,
          name: '$userDetails.name',
          email: '$userDetails.email'
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        newUsers,
        activeUsers,
        inactiveUsers,
        roleDistribution: formattedRoleDistribution,
        topCustomers
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserOrders,
  getUserStats
};