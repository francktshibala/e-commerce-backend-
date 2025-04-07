const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateJWT, isAdmin } = require('../middleware/auth.middleware');
const { commonValidators } = require('../middleware/validation.middleware');

// Admin routes
router.get('/', authenticateJWT, isAdmin, commonValidators.pagination, commonValidators.sorting, userController.getAllUsers);
router.get('/stats', authenticateJWT, isAdmin, userController.getUserStats);
router.get('/:id', authenticateJWT, isAdmin, userController.getUser);
router.put('/:id', authenticateJWT, isAdmin, userController.updateUser);
router.delete('/:id', authenticateJWT, isAdmin, userController.deleteUser);
router.get('/:id/orders', authenticateJWT, isAdmin, commonValidators.pagination, userController.getUserOrders);

module.exports = router;