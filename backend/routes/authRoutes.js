const express = require('express');
const router = express.Router();
const { register, login, forgotPassword, resetPassword, getAdminSignupStatus } = require('../controllers/authController');
const { validateRegister, validateLogin, validateForgotPassword, validateResetPassword, handleValidationErrors } = require('../middleware/validation');

// Public routes
router.get('/admin-signup-status', getAdminSignupStatus);
router.post('/register', validateRegister, handleValidationErrors, register);
router.post('/login', validateLogin, handleValidationErrors, login);
router.post('/forgot-password', validateForgotPassword, handleValidationErrors, forgotPassword);
router.post('/reset-password/:token', validateResetPassword, handleValidationErrors, resetPassword);

module.exports = router;
