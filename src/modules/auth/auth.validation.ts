import { z } from 'zod';

// ============================================================
// Helper: Require at least one field
// ============================================================

/**
 * Creates a refinement that checks at least one field is provided.
 */
const atLeastOne = (message: string = 'At least one field must be provided') =>
  (data: Record<string, any>) => Object.values(data).some(v => v !== undefined);

// ============================================================
// Auth Schemas
// ============================================================

export const verifyFirebaseTokenSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
  metadata: z.object({
    displayName: z.string().min(1, 'Display name is required').max(100, 'Display name too long').optional(),
    phoneNumber: z.string().regex(/^\+?[\d\s-]{10,15}$/, 'Invalid phone number format').optional().or(z.literal('')),
    photoURL: z.string().url('Invalid photo URL').optional(),
  }).optional(),
});

export const loginSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required to log out'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

// ============================================================
// Profile Schemas
// ============================================================

export const updateProfileSchema = z.object({
  displayName: z.string().min(1, 'Name cannot be empty').max(100, 'Name too long').optional(),
  photoURL: z.string().url('Must be a valid URL').optional(),
  bio: z.string().max(500, 'Bio too long').optional(),
  phoneNumber: z.string().regex(/^\+?[\d\s-]{10,15}$/, 'Invalid phone number').optional(),
}).refine(atLeastOne('At least one field must be provided'), {
  message: 'At least one field must be provided',
});

export const updatePreferencesSchema = z.object({
  defaultCurrency: z.enum(
    ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR'],
    { message: 'Invalid currency' }
  ).optional(),
  language: z.enum(
    ['en', 'hi', 'es', 'fr', 'de', 'ja', 'zh'],
    { message: 'Invalid language' }
  ).optional(),
  theme: z.enum(
    ['light', 'dark', 'system'],
    { message: 'Theme must be light, dark, or system' }
  ).optional(),
  timezone: z.string().optional(),
  notifications: z.object({
    push: z.boolean().optional(),
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    expenseAdded: z.boolean().optional(),
    settlementReminder: z.boolean().optional(),
    monthlyReport: z.boolean().optional(),
  }).optional(),
  appearance: z.object({
    backgroundType: z.enum(['color', 'image']).optional(),
    backgroundColor: z.string().nullable().optional(),
    backgroundImage: z.string().nullable().optional(),
    backgroundBlur: z.number().min(0).max(100).optional(),
    backgroundImagePosition: z.object({
      x: z.number(),
      y: z.number(),
      scale: z.number()
    }).optional()
  }).optional()
}).refine(atLeastOne('At least one preference must be provided'), {
  message: 'At least one preference must be provided',
});

export const updateBankingDetailsSchema = z.object({
  upiId: z.string().regex(/^[\w.-]+@[\w]+$/, 'Invalid UPI ID format (e.g., name@upi)').optional(),
  bankAccount: z.object({
    accountNumber: z.string().min(1, 'Account number is required'),
    ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
    bankName: z.string().min(1, 'Bank name is required'),
    accountHolderName: z.string().min(1, 'Account holder name is required'),
  }).optional(),
  walletDetails: z.object({
    provider: z.enum(
      ['paytm', 'phonepe', 'googlepay', 'amazonpay'],
      { message: 'Provider must be paytm, phonepe, googlepay, or amazonpay' }
    ),
    walletId: z.string().min(1, 'Wallet ID is required'),
  }).optional(),
}).refine(atLeastOne('At least one banking detail must be provided'), {
  message: 'At least one banking detail must be provided',
});

export const setUpiSchema = z.object({
  upiId: z.string()
    .min(1, 'UPI ID is required')
    .regex(/^[\w.-]+@[\w]+$/, 'Invalid UPI ID format (e.g., name@upi)'),
});

export const verifyUpiSchema = z.object({
  upiId: z.string()
    .min(1, 'UPI ID is required')
    .regex(/^[\w.-]+@[\w]+$/, 'Invalid UPI ID format'),
});

export const updateFcmTokenSchema = z.object({
  fcmToken: z.string().min(1, 'FCM token is required'),
});

// ============================================================
// User Management Schemas
// ============================================================

export const searchUsersSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const upgradeRoleSchema = z.object({
  role: z.enum(
    ['user', 'premium', 'business', 'admin'],
    { message: 'Invalid role. Must be: user, premium, business, or admin' }
  ),
});