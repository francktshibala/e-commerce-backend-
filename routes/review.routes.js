const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { authenticateJWT, isAdmin, parseAuthToken } = require('../middleware/auth.middleware');
const { reviewValidators, commonValidators } = require('../middleware/validation.middleware');

// Public routes
router.get('/product/:productId', commonValidators.pagination, commonValidators.sorting, reviewController.getProductReviews);
router.get('/:id', parseAuthToken, reviewValidators.reviewId, reviewController.getReview);

// User routes
router.post('/', authenticateJWT, reviewValidators.createReview, reviewController.createReview);
router.put('/:id', authenticateJWT, reviewValidators.reviewId, reviewController.updateReview);
router.delete('/:id', authenticateJWT, reviewValidators.reviewId, reviewController.deleteReview);
router.post('/:id/like', authenticateJWT, reviewValidators.reviewId, reviewController.likeReview);
router.delete('/:id/like', authenticateJWT, reviewValidators.reviewId, reviewController.unlikeReview);

// Admin routes
router.get('/admin/all', authenticateJWT, isAdmin, commonValidators.pagination, commonValidators.sorting, reviewController.getAllReviews);
router.put('/:id/approve', authenticateJWT, isAdmin, reviewValidators.reviewId, reviewController.approveReview);
router.post('/:id/respond', authenticateJWT, isAdmin, reviewValidators.reviewId, reviewController.respondToReview);

module.exports = router;