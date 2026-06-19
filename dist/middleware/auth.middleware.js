"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_model_1 = require("../modules/auth/auth.model");
const AppError_1 = require("../shared/errors/AppError");
const config_1 = require("../config");
/**
 * Authentication middleware — verifies JWT access token.
 * Attaches user info to req.user on success.
 */
const protect = async (req, _res, next) => {
    try {
        // 1. Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError_1.UnauthorizedError('Not authorized, no token provided'));
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return next(new AppError_1.UnauthorizedError('Not authorized, no token provided'));
        }
        // 2. Verify JWT
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET || process.env.JWT_SECRET || 'tripsplit-secret-dev');
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                return next(new AppError_1.UnauthorizedError('Token has expired. Please login again.'));
            }
            return next(new AppError_1.UnauthorizedError('Invalid token. Please login again.'));
        }
        // 3. Validate token type
        if (decoded.type !== 'access') {
            return next(new AppError_1.UnauthorizedError('Invalid token type. Use access token for API requests.'));
        }
        // 4. Find user by the userId from token (matches _id since we use UUID strings)
        const userDoc = await auth_model_1.User.findOne({
            _id: decoded.userId,
            isActive: true,
            isDeleted: false,
        }).select('email role displayName photoURL isActive isDeleted').lean();
        if (!userDoc) {
            return next(new AppError_1.UnauthorizedError('User no longer exists or account is deactivated.'));
        }
        // 5. Attach user to request
        req.user = {
            userId: decoded.userId,
            email: userDoc.email,
            role: userDoc.role,
            displayName: userDoc.displayName || 'User',
            photoURL: userDoc.photoURL || '',
        };
        next();
    }
    catch (error) {
        return next(new AppError_1.UnauthorizedError('Not authorized, authentication failed'));
    }
};
exports.protect = protect;
/**
 * Role-based authorization middleware.
 * Must be used AFTER protect middleware.
 *
 * Usage: router.post('/admin', protect, authorize('admin'), handler);
 */
const authorize = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new AppError_1.UnauthorizedError('Not authenticated'));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError_1.UnauthorizedError('Insufficient permissions'));
        }
        next();
    };
};
exports.authorize = authorize;
//# sourceMappingURL=auth.middleware.js.map