const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authenticateJWT, isAdmin } = require('../middleware/auth.middleware');
const { orderValidators, commonValidators } = require('../middleware/validation.middleware');

// User routes
router.post('/', authenticateJWT, orderValidators.createOrder, orderController.createOrder);
router.get('/', authenticateJWT, commonValidators.pagination, orderController.getUserOrders);
router.get('/:id', authenticateJWT, orderValidators.orderId, orderController.getOrder);
router.post('/:id/cancel', authenticateJWT, orderValidators.orderId, orderController.cancelOrder);

// Admin routes
router.get('/admin/all', authenticateJWT, isAdmin, commonValidators.pagination, commonValidators.sorting, orderController.getAllOrders);
router.get('/admin/stats', authenticateJWT, isAdmin, orderController.getOrderStats);
router.put('/:id/status', authenticateJWT, isAdmin, orderValidators.orderId, orderController.updateOrderStatus);
router.put('/:id/payment', authenticateJWT, isAdmin, orderValidators.orderId, orderController.updatePaymentStatus);

module.exports = router;