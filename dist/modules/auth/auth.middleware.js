"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../config");
const auth_model_1 = require("./auth.model");
const AppError_1 = require("../../shared/errors/AppError");
class AuthMiddleware {
    /**
     * Verify JWT access token
     */
    static async authenticate(req, res, next) {
        try {
            // Get token from header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new AppError_1.UnauthorizedError('No authentication token provided');
            }
            const token = authHeader.split(' ')[1];
            if (!token) {
                throw new AppError_1.UnauthorizedError('No authentication token provided');
            }
            // Verify token
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
            // Check token type
            if (decoded.type !== 'access') {
                throw new AppError_1.UnauthorizedError('Invalid token type');
            }
            // Check if user still exists and is active
            const user = await auth_model_1.User.findById(decoded.userId).select('-password -refreshTokens');
            if (!user) {
                throw new AppError_1.UnauthorizedError('User no longer exists');
            }
            if (!user.isActive) {
                throw new AppError_1.UnauthorizedError('Account is deactivated');
            }
            if (user.isDeleted) {
                throw new AppError_1.UnauthorizedError('Account has been deleted');
            }
            // Attach user info to request
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
            };
            next();
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                next(new AppError_1.UnauthorizedError('Token has expired'));
            }
            else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                next(new AppError_1.UnauthorizedError('Invalid token'));
            }
            else {
                next(error);
            }
        }
    }
    /**
     * Optional authentication - doesn't fail if no token
     */
    static async optionalAuth(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return next();
            }
            const token = authHeader.split(' ')[1];
            if (!token) {
                return next();
            }
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
            const user = await auth_model_1.User.findById(decoded.userId);
            if (user && user.isActive && !user.isDeleted) {
                req.user = {
                    userId: decoded.userId,
                    email: decoded.email,
                    role: decoded.role,
                };
            }
            next();
        }
        catch (error) {
            // Continue without authentication
            next();
        }
    }
    /**
     * Role-based authorization
     */
    static authorize(...roles) {
        return (req, res, next) => {
            if (!req.user) {
                throw new AppError_1.UnauthorizedError('Authentication required');
            }
            if (roles.length > 0 && !roles.includes(req.user.role)) {
                throw new AppError_1.ForbiddenError('Insufficient permissions');
            }
            next();
        };
    }
    /**
     * Premium user check
     */
    static async requirePremium(req, res, next) {
        try {
            if (!req.user) {
                throw new AppError_1.UnauthorizedError('Authentication required');
            }
            const user = await auth_model_1.User.findById(req.user.userId);
            if (!user || !['premium', 'business', 'admin'].includes(user.role)) {
                throw new AppError_1.ForbiddenError('Premium subscription required');
            }
            next();
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Business account check
     */
    static async requireBusiness(req, res, next) {
        try {
            if (!req.user) {
                throw new AppError_1.UnauthorizedError('Authentication required');
            }
            const user = await auth_model_1.User.findById(req.user.userId);
            if (!user || !['business', 'admin'].includes(user.role)) {
                throw new AppError_1.ForbiddenError('Business account required');
            }
            next();
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthMiddleware = AuthMiddleware;
//# sourceMappingURL=auth.middleware.js.map