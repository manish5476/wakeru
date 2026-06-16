"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeRoleSchema = exports.searchUsersSchema = exports.updateBankingDetailsSchema = exports.updatePreferencesSchema = exports.updateProfileSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.updateProfileSchema = joi_1.default.object({
    firstName: joi_1.default.string().trim().min(1).max(50).optional(),
    lastName: joi_1.default.string().trim().min(1).max(50).optional(),
    phoneNumber: joi_1.default.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    profilePicture: joi_1.default.string().uri().optional()
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});
exports.updatePreferencesSchema = joi_1.default.object({
    defaultCurrency: joi_1.default.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').optional(),
    language: joi_1.default.string().valid('en', 'hi', 'es', 'fr', 'de', 'ja', 'zh').optional(),
    notificationPreferences: joi_1.default.object({
        email: joi_1.default.boolean().optional(),
        push: joi_1.default.boolean().optional(),
        sms: joi_1.default.boolean().optional(),
        expenseReminders: joi_1.default.boolean().optional(),
        settlementReminders: joi_1.default.boolean().optional(),
        monthlyReports: joi_1.default.boolean().optional()
    }).optional(),
    theme: joi_1.default.string().valid('light', 'dark', 'system').optional(),
    timezone: joi_1.default.string().optional()
}).min(1);
exports.updateBankingDetailsSchema = joi_1.default.object({
    upiId: joi_1.default.string().pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/).optional()
        .messages({
        'string.pattern.base': 'Invalid UPI ID format'
    }),
    bankAccount: joi_1.default.object({
        accountNumber: joi_1.default.string().required(),
        ifscCode: joi_1.default.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required()
            .messages({
            'string.pattern.base': 'Invalid IFSC code format'
        }),
        bankName: joi_1.default.string().required(),
        accountHolderName: joi_1.default.string().required()
    }).optional(),
    walletDetails: joi_1.default.object({
        provider: joi_1.default.string().valid('paytm', 'phonepe', 'googlepay', 'amazonpay').required(),
        walletId: joi_1.default.string().required()
    }).optional()
}).min(1);
exports.searchUsersSchema = joi_1.default.object({
    query: joi_1.default.string().min(2).required(),
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(50).default(10)
});
exports.upgradeRoleSchema = joi_1.default.object({
    role: joi_1.default.string().valid('user', 'premium', 'business', 'admin').required()
        .messages({
        'any.only': 'Invalid role specified'
    })
});
//# sourceMappingURL=user.validation.js.map