"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const auth_validation_1 = require("./auth.validation");
const AppError_1 = require("../../shared/errors/AppError");
const auth_model_1 = require("./auth.model");
class AuthController {
    /**
     * Register new user
     */
    async register(req, res, next) {
        try {
            const { error, value } = auth_validation_1.registerSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const user = await auth_service_1.AuthService.register(value);
            const response = {
                success: true,
                message: 'Registration successful. Please verify your email.',
                data: {
                    user: user.toJSON()
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
     * Login user
     */
    async login(req, res, next) {
        try {
            const { error, value } = auth_validation_1.loginSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const { user, tokens } = await auth_service_1.AuthService.login(value.email, value.password);
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
     * Google OAuth login
     */
    async googleAuth(req, res, next) {
        try {
            const { error, value } = auth_validation_1.googleAuthSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const { user, tokens, isNewUser } = await auth_service_1.AuthService.googleAuth(value.token);
            const response = {
                success: true,
                message: isNewUser ? 'Account created successfully' : 'Login successful',
                data: {
                    user: user.toJSON(),
                    tokens,
                    isNewUser
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
     * Apple OAuth login
     */
    async appleAuth(req, res, next) {
        try {
            const { error, value } = auth_validation_1.appleAuthSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const { user, tokens, isNewUser } = await auth_service_1.AuthService.appleAuth(value.token, { firstName: value.firstName, lastName: value.lastName });
            const response = {
                success: true,
                message: isNewUser ? 'Account created successfully' : 'Login successful',
                data: {
                    user: user.toJSON(),
                    tokens,
                    isNewUser
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
     * Verify email
     */
    /* async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { error, value } = verifyEmailSchema.validate(req.params);
        if (error) {
          throw new ValidationError(error.details[0].message, error.details);
        }
  
        await AuthService.verifyEmail(value.token);
  
        const response: ApiResponse = {
          success: true,
          message: 'Email verified successfully',
          timestamp: new Date().toISOString()
        };
  
        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    } */
    /**
     * Forgot password
     */
    async forgotPassword(req, res, next) {
        try {
            const { error, value } = auth_validation_1.forgotPasswordSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            await auth_service_1.AuthService.forgotPassword(value.email);
            const response = {
                success: true,
                message: 'If the email exists, a password reset link has been sent',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Reset password
     */
    async resetPassword(req, res, next) {
        try {
            const { error, value } = auth_validation_1.resetPasswordSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            await auth_service_1.AuthService.resetPassword(value.token, value.newPassword);
            const response = {
                success: true,
                message: 'Password reset successful. Please login with your new password.',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Change password
     */
    async changePassword(req, res, next) {
        try {
            const { error, value } = auth_validation_1.changePasswordSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            await auth_service_1.AuthService.changePassword(req.user.userId, value.currentPassword, value.newPassword);
            const response = {
                success: true,
                message: 'Password changed successfully',
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