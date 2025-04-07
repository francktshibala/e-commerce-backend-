const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticateJWT, isAdmin, parseAuthToken } = require('../middleware/auth.middleware');
const { productValidators, commonValidators } = require('../middleware/validation.middleware');

// Public routes
router.get('/', commonValidators.pagination, commonValidators.sorting, productController.getProducts);
router.get('/categories', productController.getProductCategories);
router.get('/brands', productController.getProductBrands);
router.get('/:idOrSlug', parseAuthToken, productController.getProduct);
router.get('/:id/related', productValidators.productId, productController.getRelatedProducts);

// Admin routes
router.get('/admin/all', authenticateJWT, isAdmin, commonValidators.pagination, productController.getAllProductsAdmin);
router.post('/', authenticateJWT, isAdmin, productValidators.createProduct, productController.createProduct);
router.put('/:id', authenticateJWT, isAdmin, productValidators.productId, productController.updateProduct);
router.delete('/:id', authenticateJWT, isAdmin, productValidators.productId, productController.deleteProduct);

module.exports = router;