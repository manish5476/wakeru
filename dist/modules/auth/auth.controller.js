"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const auth_validation_1 = require("./auth.validation");
const AppError_1 = require("../../shared/errors/AppError");
const auth_model_1 = require("./auth.model");
class AuthController {
    /**
     * Register a new user
     */
    async register(req, res, next) {
        try {
            const { idToken, metadata } = req.body;
            if (!idToken)
                throw new AppError_1.ValidationError('idToken is required', []);
            const { user, tokens } = await auth_service_1.AuthService.register(idToken, metadata);
            const response = {
                success: true,
                message: 'Account created successfully',
                data: {
                    user: user.toJSON(),
                    tokens
                },
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Login existing user
     */
    async login(req, res, next) {
        try {
            const { idToken } = req.body;
            if (!idToken)
                throw new AppError_1.ValidationError('idToken is required', []);
            const { user, tokens } = await auth_service_1.AuthService.login(idToken);
            const response = {
                success: true,
                message: 'Login successful',
                data: {
                    user: user.toJSON(),
                    tokens
                },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Handle forgot password hook
     */
    async forgotPassword(req, res, next) {
        try {
            // Firebase handles the email. This endpoint is for tracking/logging if necessary.
            const { email } = req.body;
            if (!email)
                throw new AppError_1.ValidationError('email is required', []);
            // In a real scenario, you could log this or trigger internal analytics.
            const response = {
                success: true,
                message: 'Password reset instructions dispatched',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Refresh access token
     */
    async refreshToken(req, res, next) {
        try {
            const { error, value } = auth_validation_1.refreshTokenSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const tokens = await auth_service_1.AuthService.refreshToken(value.refreshToken);
            const response = {
                success: true,
                message: 'Token refreshed successfully',
                data: { tokens },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Logout user
     */
    async logout(req, res, next) {
        try {
            const refreshToken = req.body.refreshToken;
            await auth_service_1.AuthService.logout(req.user.userId, refreshToken);
            const response = {
                success: true,
                message: 'Logged out successfully',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get current user profile
     */
    async getProfile(req, res, next) {
        try {
            const user = await auth_model_1.User.findById(req.user.userId);
            if (!user) {
                throw new AppError_1.NotFoundError('User');
            }
            const response = {
                success: true,
                data: { user: user.toJSON() },
                timestamp: new Date().toISOString(),
                message: 'Profile fetched successfully'
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map