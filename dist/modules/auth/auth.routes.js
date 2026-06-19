"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("./auth.middleware");
const validation_middleware_1 = require("../../middleware/validation.middleware");
const rateLimiter_middleware_1 = require("../../middleware/rateLimiter.middleware");
const auth_validation_1 = require("./auth.validation");
const router = (0, express_1.Router)();
// ============================================================
// PUBLIC ROUTES — No Authentication Required
// Rate limited strictly to prevent abuse
// ============================================================
router.post('/register', rateLimiter_middleware_1.strictRateLimiter, validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.verifyFirebaseTokenSchema), auth_controller_1.authController.register.bind(auth_controller_1.authController));
router.post('/login', rateLimiter_middleware_1.strictRateLimiter, validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.loginSchema), auth_controller_1.authController.login.bind(auth_controller_1.authController));
router.post('/forgot-password', rateLimiter_middleware_1.strictRateLimiter, validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.forgotPasswordSchema), auth_controller_1.authController.forgotPassword.bind(auth_controller_1.authController));
router.post('/refresh-token', validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.refreshTokenSchema), auth_controller_1.authController.refreshToken.bind(auth_controller_1.authController));
// ============================================================
// PROTECTED ROUTES — Require Valid Access Token
// ============================================================
router.use(auth_middleware_1.protect);
// Logout
router.post('/logout', validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.logoutSchema), auth_controller_1.authController.logout.bind(auth_controller_1.authController));
router.post('/logout-all', auth_controller_1.authController.logoutAll.bind(auth_controller_1.authController));
// Profile
router.get('/me', auth_controller_1.authController.getProfile.bind(auth_controller_1.authController));
router.patch('/me', validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.updateProfileSchema), auth_controller_1.authController.updateProfile.bind(auth_controller_1.authController));
// UPI
router.put('/me/upi', validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.setUpiSchema), auth_controller_1.authController.setUpiId.bind(auth_controller_1.authController));
router.post('/me/upi/verify', validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.verifyUpiSchema), auth_controller_1.authController.verifyUpi.bind(auth_controller_1.authController));
// Push Notifications
router.put('/me/fcm-token', validation_middleware_1.ValidationMiddleware.validate(auth_validation_1.updateFcmTokenSchema), auth_controller_1.authController.updateFcmToken.bind(auth_controller_1.authController));
// Account Management
router.delete('/me', auth_controller_1.authController.deleteAccount.bind(auth_controller_1.authController));
exports.authRoutes = router;
//# sourceMappingURL=auth.routes.js.map