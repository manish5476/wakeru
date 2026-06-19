"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upiVerificationRateLimiter = exports.ocrUploadRateLimiter = exports.expenseCreateRateLimiter = exports.authRateLimiter = exports.strictRateLimiter = exports.authenticatedRateLimiter = exports.publicRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const constants_1 = require("../config/constants");
// ============================================================
// Standard Rate Limiters
// ============================================================
exports.publicRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: constants_1.CONSTANTS.RATE_LIMITS.PUBLIC.windowMs,
    max: constants_1.CONSTANTS.RATE_LIMITS.PUBLIC.max,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.authenticatedRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: constants_1.CONSTANTS.RATE_LIMITS.AUTHENTICATED.windowMs,
    max: constants_1.CONSTANTS.RATE_LIMITS.AUTHENTICATED.max,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// ============================================================
// Strict Rate Limiters — Auth Endpoints
// ============================================================
/**
 * Strict rate limiter for authentication endpoints.
 * Prevents brute force attacks on login/register/forgot-password.
 *
 * 10 requests per 15 minutes per IP — very strict.
 */
exports.strictRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts. Please try again in 15 minutes.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all attempts, even successful ones
});
/**
 * Slightly more lenient auth limiter — 30 requests per 15 minutes.
 * Use for token refresh and other auth-related but less sensitive endpoints.
 */
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 attempts per window
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// ============================================================
// Feature-Specific Rate Limiters
// ============================================================
exports.expenseCreateRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: constants_1.CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.windowMs,
    max: constants_1.CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.max,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many expenses created, please slow down'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});
exports.ocrUploadRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: constants_1.CONSTANTS.RATE_LIMITS.OCR_UPLOAD.windowMs,
    max: constants_1.CONSTANTS.RATE_LIMITS.OCR_UPLOAD.max,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many uploads, please try again later'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});
/**
 * UPI verification rate limiter.
 * Prevents abuse of penny drop verification.
 */
exports.upiVerificationRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many UPI verification attempts. Please try again in 1 hour.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});
//# sourceMappingURL=rateLimiter.middleware.js.map