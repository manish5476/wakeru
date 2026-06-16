"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware"); // Assuming you have this middleware
const router = (0, express_1.Router)();
// Public routes
router.post('/register', auth_controller_1.authController.register);
router.post('/login', auth_controller_1.authController.login);
router.post('/google', auth_controller_1.authController.googleAuth);
router.post('/apple', auth_controller_1.authController.appleAuth);
router.post('/refresh-token', auth_controller_1.authController.refreshToken);
// router.get('/verify-email/:token', authController.verifyEmail);
router.post('/forgot-password', auth_controller_1.authController.forgotPassword);
router.post('/reset-password', auth_controller_1.authController.resetPassword);
// Protected routes
router.post('/logout', auth_middleware_1.protect, auth_controller_1.authController.logout);
router.post('/change-password', auth_middleware_1.protect, auth_controller_1.authController.changePassword);
router.get('/profile', auth_middleware_1.protect, auth_controller_1.authController.getProfile);
exports.authRoutes = router;
//# sourceMappingURL=auth.route.js.map