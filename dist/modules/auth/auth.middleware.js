"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.authorize = exports.protect = exports.AuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../../config");
const auth_model_1 = require("./auth.model");
const AppError_1 = require("../../shared/errors/AppError");
// ============================================================
// Auth Middleware Class
// ============================================================
class AuthMiddleware {
    /**
     * Authenticate request using Bearer JWT access token.
     * Attaches user info to req.user on success.
     */
    static async authenticate(req, _res, next) {
        try {
            // Extract token from Authorization header
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new AppError_1.UnauthorizedError('No authentication token provided');
            }
            const token = authHeader.split(' ')[1];
            if (!token || token === 'null' || token === 'undefined') {
                throw new AppError_1.UnauthorizedError('Invalid authentication token');
            }
            // Verify JWT signature + expiry
            let decoded;
            try {
                decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
            }
            catch (error) {
                if (error.name === 'TokenExpiredError') {
                    throw new AppError_1.UnauthorizedError('Token has expired. Please refresh your token.');
                }
                if (error.name === 'JsonWebTokenError') {
                    throw new AppError_1.UnauthorizedError('Invalid token. Please login again.');
                }
                throw new AppError_1.UnauthorizedError('Token verification failed');
            }
            // Validate token type — only access tokens allowed for API access
            if (decoded.type !== 'access') {
                throw new AppError_1.UnauthorizedError('Invalid token type. Use access token for API requests.');
            }
            // Read user from DATABASE (not token) to get current role
            // This ensures role changes take effect immediately
            // const user = await User.findOne(
            //   { 
            //     _id: decoded.userId,
            //     isActive: true,
            //     isDeleted: false,
            //   },
            //   'email role isActive isDeleted'
            // ).lean();
            // if (!user) {
            //   throw new UnauthorizedError('Account not found or has been deactivated');
            // }
            // // Attach user to request
            // req.user = {
            //   userId: decoded.userId,
            //   email: user.email,
            //   role: user.role,
            // };
            // ✅ UPGRADED:
            const user = await auth_model_1.User.findOne({ _id: decoded.userId, isActive: true, isDeleted: false }, 'email role displayName photoURL isActive isDeleted' // ← ADDED
            ).lean();
            if (!user) {
                throw new AppError_1.UnauthorizedError('Account not found or has been deactivated');
            }
            req.user = {
                userId: decoded.userId,
                email: user.email,
                role: user.role,
                displayName: user.displayName || 'User', // ← ADDED
                photoURL: user.photoURL || '', // ← ADDED
            };
            next();
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Role-based authorization guard.
     * Use after authenticate middleware.
     */
    static authorize(...allowedRoles) {
        return (req, _res, next) => {
            try {
                if (!req.user) {
                    throw new AppError_1.UnauthorizedError('Authentication required');
                }
                if (!allowedRoles.includes(req.user.role)) {
                    throw new AppError_1.ForbiddenError(`Access denied. Required role: ${allowedRoles.join(' or ')}`);
                }
                next();
            }
            catch (error) {
                next(error);
            }
        };
    }
    /**
     * Optional authentication — attaches user if token present, continues if not.
     * Useful for public endpoints that behave differently for logged-in users.
     */
    static async optional(req, _res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return next(); // No token — continue without user
            }
            const token = authHeader.split(' ')[1];
            if (!token || token === 'null') {
                return next();
            }
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
            if (decoded.type !== 'access') {
                return next(); // Wrong token type — continue without user
            }
            const user = await auth_model_1.User.findOne({ _id: decoded.userId, isActive: true, isDeleted: false }, 'email role').lean();
            if (user) {
                req.user = {
                    userId: decoded.userId,
                    email: user.email,
                    role: user.role,
                };
            }
            next();
        }
        catch {
            // Token invalid/expired — continue without user
            next();
        }
    }
}
exports.AuthMiddleware = AuthMiddleware;
// ============================================================
// Convenience Exports
// ============================================================
exports.protect = AuthMiddleware.authenticate;
exports.authorize = AuthMiddleware.authorize;
exports.optionalAuth = AuthMiddleware.optional;
//# sourceMappingURL=auth.middleware.js.map