const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { authenticateJWT, isAdmin } = require('../middleware/auth.middleware');
const { categoryValidators, commonValidators } = require('../middleware/validation.middleware');

// Public routes
router.get('/', categoryController.getCategories);
router.get('/:idOrSlug', categoryController.getCategory);
router.get('/:idOrSlug/products', commonValidators.pagination, commonValidators.sorting, categoryController.getCategoryProducts);

// Admin routes
router.post('/', authenticateJWT, isAdmin, categoryValidators.createCategory, categoryController.createCategory);
router.put('/:id', authenticateJWT, isAdmin, categoryValidators.categoryId, categoryController.updateCategory);
router.delete('/:id', authenticateJWT, isAdmin, categoryValidators.categoryId, categoryController.deleteCategory);

module.exports = router;