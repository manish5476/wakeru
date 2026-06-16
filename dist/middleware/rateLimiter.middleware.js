"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrUploadRateLimiter = exports.expenseCreateRateLimiter = exports.authenticatedRateLimiter = exports.publicRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const constants_1 = require("../config/constants");
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
    legacyHeaders: false
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
    legacyHeaders: false
});
exports.expenseCreateRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: constants_1.CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.windowMs,
    max: constants_1.CONSTANTS.RATE_LIMITS.EXPENSE_CREATE.max,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many expenses created, please slow down'
        }
    }
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
    }
});
//# sourceMappingURL=rateLimiter.middleware.js.map