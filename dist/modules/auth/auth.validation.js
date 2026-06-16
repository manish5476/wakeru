"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.verifyEmailSchema = exports.refreshTokenSchema = exports.appleAuthSchema = exports.googleAuthSchema = exports.loginSchema = exports.registerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
    }),
    password: joi_1.default.string().min(8).max(128).required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password must not exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
    }),
    firstName: joi_1.default.string().trim().min(1).max(50).required()
        .messages({
        'any.required': 'First name is required'
    }),
    lastName: joi_1.default.string().trim().min(1).max(50).required()
        .messages({
        'any.required': 'Last name is required'
    }),
    phoneNumber: joi_1.default.string().pattern(/^\+?[1-9]\d{1,14}$/).optional()
        .messages({
        'string.pattern.base': 'Please provide a valid phone number'
    }),
    defaultCurrency: joi_1.default.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').default('INR')
});
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required()
        .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
    }),
    password: joi_1.default.string().required()
        .messages({
        'any.required': 'Password is required'
    })
});
exports.googleAuthSchema = joi_1.default.object({
    token: joi_1.default.string().required()
        .messages({
        'any.required': 'Google token is required'
    })
});
exports.appleAuthSchema = joi_1.default.object({
    token: joi_1.default.string().required()
        .messages({
        'any.required': 'Apple token is required'
    }),
    firstName: joi_1.default.string().optional(),
    lastName: joi_1.default.string().optional()
});
exports.refreshTokenSchema = joi_1.default.object({
    refreshToken: joi_1.default.string().required()
        .messages({
        'any.required': 'Refresh token is required'
    })
});
exports.verifyEmailSchema = joi_1.default.object({
    token: joi_1.default.string().required()
        .messages({
        'any.required': 'Verification token is required'
    })
});
exports.forgotPasswordSchema = joi_1.default.object({
    email: joi_1.default.string().email().required()
        .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
    })
});
exports.resetPasswordSchema = joi_1.default.object({
    token: joi_1.default.string().required()
        .messages({
        'any.required': 'Reset token is required'
    }),
    newPassword: joi_1.default.string().min(8).max(128).required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
    })
});
exports.changePasswordSchema = joi_1.default.object({
    currentPassword: joi_1.default.string().required()
        .messages({
        'any.required': 'Current password is required'
    }),
    newPassword: joi_1.default.string().min(8).max(128).required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
    })
});
//# sourceMappingURL=auth.validation.js.map