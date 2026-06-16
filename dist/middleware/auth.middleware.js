"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_model_1 = require("../modules/auth/auth.model");
const AppError_1 = require("../shared/errors/AppError");
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            // Verify token
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'a-very-secret-key');
            // Get user from the token
            const userDoc = await auth_model_1.User.findById(decoded.id);
            if (!userDoc) {
                return next(new AppError_1.UnauthorizedError('User belonging to this token does no longer exist.'));
            }
            // Attach a lean user object to the request that matches the AuthenticatedRequest type
            req.user = {
                userId: userDoc.userId,
                email: userDoc.email,
                role: userDoc.role,
            };
            next();
        }
        catch (error) {
            return next(new AppError_1.UnauthorizedError('Not authorized, token failed'));
        }
    }
    if (!token) {
        return next(new AppError_1.UnauthorizedError('Not authorized, no token'));
    }
};
exports.protect = protect;
//# sourceMappingURL=auth.middleware.js.map