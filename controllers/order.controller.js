const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const { ApiError } = require('../middleware/error.middleware');

/**
 * Create a new order
 * @route POST /api/orders
 * @access Private
 */
const createOrder = async (req, res, next) => {
  try {
    const {
      items,
      billing,
      shipping,
      payment,
      notes
    } = req.body;
    
    // Get user
    const user = await User.findById(req.user._id);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Initialize order items and calculations
    const orderItems = [];
    let subtotal = 0;
    
    // Process each order item
    for (const item of items) {
      // Get product
      const product = await Product.findById(item.product);
      
      if (!product) {
        throw new ApiError(404, `Product not found with ID: ${item.product}`);
      }
      
      // Check if product is published
      if (!product.isPublished) {
        throw new ApiError(400, `Product ${product.name} is not available`);
      }
      
      // Check if enough inventory
      if (product.inventory.available < item.quantity) {
        throw new ApiError(400, `Not enough inventory for ${product.name}`);
      }
      
      // Get main image URL
      const mainImage = product.images.find(img => img.isMain)
        || product.images[0]
        || { url: null };
      
      // Add to order items
      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: mainImage.url,
        sku: product.sku
      });
      
      // Add to subtotal
      subtotal += product.price * item.quantity;
    }
    
    // Calculate tax (example: 10%)
    const taxRate = 0.1;
    const tax = subtotal * taxRate;
    
    // Calculate total
    const shippingCost = shipping.cost || 0;
    const discountAmount = req.body.discount?.amount || 0;
    const total = subtotal + tax + shippingCost - discountAmount;
    
    // Create order
    const order = new Order({
      user: user._id,
      items: orderItems,
      billing,
      shipping,
      payment,
      subtotal,
      tax,
      discount: req.body.discount || { amount: 0 },
      total,
      notes,
      status: 'pending'
    });
    
    await order.save();
    
    // Clear user's cart
    await user.clearCart();
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all orders for the current user
 * @route GET /api/orders
 * @access Private
 */
const getUserOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status
    } = req.query;
    
    // Build filter object
    const filter = { user: req.user._id };
    
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
      .limit(Number(limit))
      .select('orderNumber createdAt total status items.name items.quantity items.price payment.status');
    
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
 * Get a single order
 * @route GET /api/orders/:id
 * @access Private
 */
const getOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find order
    const order = await Order.findById(id);
    
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    
    // Check if order belongs to the current user or user is admin
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new ApiError(403, 'Not authorized to access this order');
    }
    
    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an order
 * @route POST /api/orders/:id/cancel
 * @access Private
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Find order
    const order = await Order.findById(id);
    
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    
    // Check if order belongs to the current user or user is admin
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      throw new ApiError(403, 'Not authorized to cancel this order');
    }
    
    // Check if order can be cancelled
    if (order.status !== 'pending' && order.status !== 'processing') {
      throw new ApiError(400, 'Only pending or processing orders can be cancelled');
    }
    
    // Cancel order
    await order.cancel(reason, req.user._id);
    
    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all orders
 * @route GET /api/orders/admin/all
 * @access Private (Admin only)
 */
const getAllOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdAt',
      order = 'desc',
      startDate,
      endDate,
      search
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Filter by status if provided
    if (status) {
      filter.status = status;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateTime;
      }
    }
    
    // Search by order number or customer email
    if (search) {
      filter.$or = [
        { orderNumber: new RegExp(search, 'i') }
      ];
      
      // Check if search is a valid ObjectId
      if (/^[0-9a-fA-F]{24}$/.test(search)) {
        filter.$or.push({ user: search });
      }
      
      // Find users matching the search
      const users = await User.find({
        $or: [
          { name: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id');
      
      // Add user IDs to the filter
      if (users.length > 0) {
        filter.$or.push({ user: { $in: users.map(u => u._id) } });
      }
    }
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;
    
    // Get orders
    const orders = await Order.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name email');
    
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
 * Admin: Update order status
 * @route PUT /api/orders/:id/status
 * @access Private (Admin only)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;
    
    // Find order
    const order = await Order.findById(id);
    
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    
    // Update order status
    await order.updateStatus(status, comment, req.user._id);
    
    // Update inventory if order is completed/delivered
    if (status === 'delivered' || status === 'completed') {
      // For each product, decrease the reserved quantity
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: {
              'inventory.quantity': -item.quantity,
              'inventory.reserved': -item.quantity
            }
          }
        );
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update order payment status
 * @route PUT /api/orders/:id/payment
 * @access Private (Admin only)
 */
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, transactionId } = req.body;
    
    // Find order
    const order = await Order.findById(id);
    
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    
    // Update payment information
    order.payment.status = status;
    if (transactionId) {
      order.payment.transactionId = transactionId;
    }
    
    // If payment completed, record date
    if (status === 'completed') {
      order.payment.paidAt = new Date();
    }
    
    // Add status change to history
    order.statusHistory.push({
      status: `Payment ${status}`,
      timestamp: new Date(),
      comment: transactionId ? `Transaction ID: ${transactionId}` : undefined,
      updatedBy: req.user._id
    });
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get order statistics
 * @route GET /api/orders/admin/stats
 * @access Private (Admin only)
 */
const getOrderStats = async (req, res, next) => {
  try {
    const { period = 'week' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    // Set date filter based on period
    if (period === 'day') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      dateFilter = { createdAt: { $gte: startOfDay } };
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: startOfWeek } };
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { $gte: startOfMonth } };
    } else if (period === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { createdAt: { $gte: startOfYear } };
    }
    
    // Get order counts by status
    const statusCounts = await Order.aggregate([
      { $match: dateFilter },
      { $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get total sales and average order value
    const salesStats = await Order.aggregate([
      { $match: { ...dateFilter, status: { $nin: ['cancelled', 'refunded'] } } },
      { $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalSales = salesStats.length > 0 ? salesStats[0].totalSales : 0;
    const orderCount = salesStats.length > 0 ? salesStats[0].count : 0;
    const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
    
    // Format status counts into an object
    const formattedStatusCounts = {};
    statusCounts.forEach(item => {
      formattedStatusCounts[item._id] = item.count;
    });
    
    res.status(200).json({
      success: true,
      stats: {
        statusCounts: formattedStatusCounts,
        totalSales,
        orderCount,
        averageOrderValue
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrder,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderStats
};