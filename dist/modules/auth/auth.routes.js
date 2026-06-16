"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("./auth.middleware");
const express_rate_limit_1 = require("express-rate-limit");
const router = (0, express_1.Router)();
// Rate limiters
const authLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: {
        success: false,
        message: 'Too many attempts, please try again later'
    }
});
const passwordResetLimiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: {
        success: false,
        message: 'Too many password reset attempts'
    }
});
// Public routes
router.post('/register', authLimiter, auth_controller_1.authController.register.bind(auth_controller_1.authController));
router.post('/login', authLimiter, auth_controller_1.authController.login.bind(auth_controller_1.authController));
router.post('/google', auth_controller_1.authController.googleAuth.bind(auth_controller_1.authController));
router.post('/apple', auth_controller_1.authController.appleAuth.bind(auth_controller_1.authController));
router.post('/refresh-token', auth_controller_1.authController.refreshToken.bind(auth_controller_1.authController));
// router.get('/verify-email/:token', authController.verifyEmail.bind(authController));
router.post('/forgot-password', passwordResetLimiter, auth_controller_1.authController.forgotPassword.bind(auth_controller_1.authController));
router.post('/reset-password', passwordResetLimiter, auth_controller_1.authController.resetPassword.bind(auth_controller_1.authController));
// Protected routes
router.use(auth_middleware_1.AuthMiddleware.authenticate);
router.post('/logout', auth_controller_1.authController.logout.bind(auth_controller_1.authController));
router.post('/change-password', auth_controller_1.authController.changePassword.bind(auth_controller_1.authController));
router.get('/profile', auth_controller_1.authController.getProfile.bind(auth_controller_1.authController));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map