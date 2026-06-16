"use strict";
// import { Router } from 'express';
// import { authController } from './auth.controller';
// import { AuthMiddleware } from './auth.middleware';
// import { rateLimit } from 'express-rate-limit';
// const router = Router();
// // Rate limiters
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 10, // 10 attempts per window
//   message: {
//     success: false,
//     message: 'Too many attempts, please try again later'
//   }
// });
// const passwordResetLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, // 1 hour
//   max: 5,
//   message: {
//     success: false,
//     message: 'Too many password reset attempts'
//   }
// });
// // Public routes
// router.post('/register', authLimiter, authController.register.bind(authController));
// router.post('/login', authLimiter, authController.login.bind(authController));
// router.post('/google', authController.googleAuth.bind(authController));
// router.post('/apple', authController.appleAuth.bind(authController));
// router.post('/refresh-token', authController.refreshToken.bind(authController));
// router.get('/verify-email/:token', authController.verifyEmail.bind(authController));
// router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword.bind(authController));
// router.post('/reset-password', passwordResetLimiter, authController.resetPassword.bind(authController));
// // Protected routes
// router.use(AuthMiddleware.authenticate);
// router.post('/logout', authController.logout.bind(authController));
// router.post('/change-password', authController.changePassword.bind(authController));
// router.get('/profile', authController.getProfile.bind(authController));
// export default router;
//# sourceMappingURL=auth.routes.js.map