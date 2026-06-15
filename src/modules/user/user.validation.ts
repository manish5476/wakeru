import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(50).optional(),
  lastName: Joi.string().trim().min(1).max(50).optional(),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  profilePicture: Joi.string().uri().optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const updatePreferencesSchema = Joi.object({
  defaultCurrency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').optional(),
  language: Joi.string().valid('en', 'hi', 'es', 'fr', 'de', 'ja', 'zh').optional(),
  notificationPreferences: Joi.object({
    email: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
    sms: Joi.boolean().optional(),
    expenseReminders: Joi.boolean().optional(),
    settlementReminders: Joi.boolean().optional(),
    monthlyReports: Joi.boolean().optional()
  }).optional(),
  theme: Joi.string().valid('light', 'dark', 'system').optional(),
  timezone: Joi.string().optional()
}).min(1);

export const updateBankingDetailsSchema = Joi.object({
  upiId: Joi.string().pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/).optional()
    .messages({
      'string.pattern.base': 'Invalid UPI ID format'
    }),
  bankAccount: Joi.object({
    accountNumber: Joi.string().required(),
    ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required()
      .messages({
        'string.pattern.base': 'Invalid IFSC code format'
      }),
    bankName: Joi.string().required(),
    accountHolderName: Joi.string().required()
  }).optional(),
  walletDetails: Joi.object({
    provider: Joi.string().valid('paytm', 'phonepe', 'googlepay', 'amazonpay').required(),
    walletId: Joi.string().required()
  }).optional()
}).min(1);

export const searchUsersSchema = Joi.object({
  query: Joi.string().min(2).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10)
});

export const upgradeRoleSchema = Joi.object({
  role: Joi.string().valid('user', 'premium', 'business', 'admin').required()
    .messages({
      'any.only': 'Invalid role specified'
    })
});