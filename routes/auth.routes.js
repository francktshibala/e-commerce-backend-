const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');
const { userValidators } = require('../middleware/validation.middleware');

// Public routes
router.post('/register', userValidators.register, authController.register);
router.post('/login', userValidators.login, authController.login);
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

// Protected routes
router.get('/me', authenticateJWT, authController.getProfile);
router.put('/me', authenticateJWT, authController.updateProfile);
router.post('/change-password', authenticateJWT, authController.changePassword);

// Address management
router.post('/addresses', authenticateJWT, userValidators.address, authController.addAddress);
router.put('/addresses/:addressId', authenticateJWT, userValidators.address, authController.updateAddress);
router.delete('/addresses/:addressId', authenticateJWT, authController.deleteAddress);

module.exports = router;