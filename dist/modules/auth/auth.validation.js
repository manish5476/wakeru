"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeRoleSchema = exports.searchUsersSchema = exports.updateFcmTokenSchema = exports.verifyUpiSchema = exports.setUpiSchema = exports.updateBankingDetailsSchema = exports.updatePreferencesSchema = exports.updateProfileSchema = exports.forgotPasswordSchema = exports.logoutSchema = exports.refreshTokenSchema = exports.loginSchema = exports.verifyFirebaseTokenSchema = void 0;
const zod_1 = require("zod");
// ============================================================
// Helper: Require at least one field
// ============================================================
/**
 * Creates a refinement that checks at least one field is provided.
 */
const atLeastOne = (message = 'At least one field must be provided') => (data) => Object.values(data).some(v => v !== undefined);
// ============================================================
// Auth Schemas
// ============================================================
exports.verifyFirebaseTokenSchema = zod_1.z.object({
    idToken: zod_1.z.string().min(1, 'Firebase ID token is required'),
    metadata: zod_1.z.object({
        displayName: zod_1.z.string().min(1, 'Display name is required').max(100, 'Display name too long').optional(),
        phoneNumber: zod_1.z.string().regex(/^\+?[\d\s-]{10,15}$/, 'Invalid phone number format').optional(),
        photoURL: zod_1.z.string().url('Invalid photo URL').optional(),
    }).optional(),
});
exports.loginSchema = zod_1.z.object({
    idToken: zod_1.z.string().min(1, 'Firebase ID token is required'),
});
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
exports.logoutSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required to log out'),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email is required'),
});
// ============================================================
// Profile Schemas
// ============================================================
exports.updateProfileSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(1, 'Name cannot be empty').max(100, 'Name too long').optional(),
    photoURL: zod_1.z.string().url('Must be a valid URL').optional(),
    bio: zod_1.z.string().max(500, 'Bio too long').optional(),
    phoneNumber: zod_1.z.string().regex(/^\+?[\d\s-]{10,15}$/, 'Invalid phone number').optional(),
}).refine(atLeastOne('At least one field must be provided'), {
    message: 'At least one field must be provided',
});
exports.updatePreferencesSchema = zod_1.z.object({
    defaultCurrency: zod_1.z.enum(['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR'], { message: 'Invalid currency' }).optional(),
    language: zod_1.z.enum(['en', 'hi', 'es', 'fr', 'de', 'ja', 'zh'], { message: 'Invalid language' }).optional(),
    theme: zod_1.z.enum(['light', 'dark', 'system'], { message: 'Theme must be light, dark, or system' }).optional(),
    timezone: zod_1.z.string().optional(),
    notifications: zod_1.z.object({
        push: zod_1.z.boolean().optional(),
        email: zod_1.z.boolean().optional(),
        sms: zod_1.z.boolean().optional(),
        expenseAdded: zod_1.z.boolean().optional(),
        settlementReminder: zod_1.z.boolean().optional(),
        monthlyReport: zod_1.z.boolean().optional(),
    }).optional(),
}).refine(atLeastOne('At least one preference must be provided'), {
    message: 'At least one preference must be provided',
});
exports.updateBankingDetailsSchema = zod_1.z.object({
    upiId: zod_1.z.string().regex(/^[\w.-]+@[\w]+$/, 'Invalid UPI ID format (e.g., name@upi)').optional(),
    bankAccount: zod_1.z.object({
        accountNumber: zod_1.z.string().min(1, 'Account number is required'),
        ifscCode: zod_1.z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
        bankName: zod_1.z.string().min(1, 'Bank name is required'),
        accountHolderName: zod_1.z.string().min(1, 'Account holder name is required'),
    }).optional(),
    walletDetails: zod_1.z.object({
        provider: zod_1.z.enum(['paytm', 'phonepe', 'googlepay', 'amazonpay'], { message: 'Provider must be paytm, phonepe, googlepay, or amazonpay' }),
        walletId: zod_1.z.string().min(1, 'Wallet ID is required'),
    }).optional(),
}).refine(atLeastOne('At least one banking detail must be provided'), {
    message: 'At least one banking detail must be provided',
});
exports.setUpiSchema = zod_1.z.object({
    upiId: zod_1.z.string()
        .min(1, 'UPI ID is required')
        .regex(/^[\w.-]+@[\w]+$/, 'Invalid UPI ID format (e.g., name@upi)'),
});
exports.verifyUpiSchema = zod_1.z.object({
    upiId: zod_1.z.string()
        .min(1, 'UPI ID is required')
        .regex(/^[\w.-]+@[\w]+$/, 'Invalid UPI ID format'),
});
exports.updateFcmTokenSchema = zod_1.z.object({
    fcmToken: zod_1.z.string().min(1, 'FCM token is required'),
});
// ============================================================
// User Management Schemas
// ============================================================
exports.searchUsersSchema = zod_1.z.object({
    query: zod_1.z.string().min(2, 'Search query must be at least 2 characters'),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
});
exports.upgradeRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(['user', 'premium', 'business', 'admin'], { message: 'Invalid role. Must be: user, premium, business, or admin' }),
});
//# sourceMappingURL=auth.validation.js.map