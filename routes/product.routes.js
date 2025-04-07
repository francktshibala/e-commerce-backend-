const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticateJWT, isAdmin, parseAuthToken } = require('../middleware/auth.middleware');
const { productValidators, commonValidators } = require('../middleware/validation.middleware');

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products
 *     description: Retrieve a list of products with pagination, filtering, and sorting
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ID to filter by
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *     responses:
 *       200:
 *         description: A list of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 */
router.get('/', commonValidators.pagination, commonValidators.sorting, productController.getProducts);

/**
 * @swagger
 * /products/categories:
 *   get:
 *     summary: Get product categories
 *     description: Retrieve categories that have associated products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 categories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 */
router.get('/categories', productController.getProductCategories);

/**
 * @swagger
 * /products/brands:
 *   get:
 *     summary: Get product brands
 *     description: Retrieve all distinct brands from products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of brands
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 brands:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/brands', productController.getProductBrands);

/**
 * @swagger
 * /products/{idOrSlug}:
 *   get:
 *     summary: Get product by ID or slug
 *     description: Retrieve a single product by its ID or slug
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID or slug
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:idOrSlug', parseAuthToken, productController.getProduct);

/**
 * @swagger
 * /products/{id}/related:
 *   get:
 *     summary: Get related products
 *     description: Retrieve products related to the specified product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *         description: Number of related products to return
 *     responses:
 *       200:
 *         description: List of related products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
router.get('/:id/related', productValidators.productId, productController.getRelatedProducts);

/**
 * @swagger
 * /products/admin/all:
 *   get:
 *     summary: Admin - Get all products
 *     description: Admin endpoint to get all products, including unpublished
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of all products
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 */
router.get('/admin/all', authenticateJWT, isAdmin, commonValidators.pagination, productController.getAllProductsAdmin);

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a new product
 *     description: Admin endpoint to create a new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - price
 *               - sku
 *               - inventory
 *               - categories
 *             properties:
 *               name:
 *                 type: string
 *                 description: Product name
 *               description:
 *                 type: string
 *                 description: Product description
 *               price:
 *                 type: number
 *                 description: Product price
 *               sku:
 *                 type: string
 *                 description: Stock keeping unit
 *               inventory:
 *                 type: object
 *                 properties:
 *                   quantity:
 *                     type: integer
 *                     description: Inventory quantity
 *                   reserved:
 *                     type: integer
 *                     description: Reserved quantity
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of category IDs
 *               brand:
 *                 type: string
 *                 description: Product brand
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     alt:
 *                       type: string
 *                     isMain:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 product:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 */
router.post('/', authenticateJWT, isAdmin, productValidators.createProduct, productController.createProduct);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update a product
 *     description: Admin endpoint to update an existing product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               inventory:
 *                 type: object
 *                 properties:
 *                   quantity:
 *                     type: integer
 *               isPublished:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 *       404:
 *         description: Product not found
 */
router.put('/:id', authenticateJWT, isAdmin, productValidators.productId, productController.updateProduct);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete a product
 *     description: Admin endpoint to delete a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not an admin
 *       404:
 *         description: Product not found
 */
router.delete('/:id', authenticateJWT, isAdmin, productValidators.productId, productController.deleteProduct);

module.exports = router;