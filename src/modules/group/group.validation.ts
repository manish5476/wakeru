import Joi from 'joi';

export const createGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required()
    .messages({
      'any.required': 'Group name is required',
      'string.max': 'Group name cannot exceed 100 characters'
    }),
  description: Joi.string().max(500).optional(),
  type: Joi.string().valid('TRIP', 'HOUSEHOLD', 'TEAM', 'EVENT', 'PROJECT', 'CUSTOM').required()
    .messages({
      'any.required': 'Group type is required',
      'any.only': 'Invalid group type'
    }),
  avatar: Joi.string().uri().optional(),
  settings: Joi.object({
    defaultCurrency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').optional(),
    defaultSplitType: Joi.string().valid('EQUAL', 'PROPORTIONAL').optional(),
    enableReceiptScanning: Joi.boolean().optional(),
    enableAutoSettlement: Joi.boolean().optional(),
    settlementThreshold: Joi.number().min(0).optional(),
    categories: Joi.array().items(Joi.string()).optional(),
    customCategories: Joi.array().items(Joi.string()).optional()
  }).optional(),
  memberIds: Joi.array().items(Joi.string()).max(50).optional()
    .messages({
      'array.max': 'Maximum 50 members allowed'
    })
});

export const updateGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().max(500).optional().allow(''),
  avatar: Joi.string().uri().optional().allow(''),
  settings: Joi.object({
    defaultCurrency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').optional(),
    defaultSplitType: Joi.string().valid('EQUAL', 'PROPORTIONAL').optional(),
    enableReceiptScanning: Joi.boolean().optional(),
    enableAutoSettlement: Joi.boolean().optional(),
    settlementThreshold: Joi.number().min(0).optional(),
    categories: Joi.array().items(Joi.string()).optional(),
    customCategories: Joi.array().items(Joi.string()).optional()
  }).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const addMemberSchema = Joi.object({
  userId: Joi.string().required()
    .messages({
      'any.required': 'User ID is required'
    }),
  role: Joi.string().valid('ADMIN', 'MEMBER', 'VIEWER').default('MEMBER')
});

export const updateMemberRoleSchema = Joi.object({
  role: Joi.string().valid('ADMIN', 'MEMBER', 'VIEWER').required()
    .messages({
      'any.required': 'Role is required',
      'any.only': 'Invalid role'
    })
});

export const joinByInviteSchema = Joi.object({
  inviteCode: Joi.string().required()
    .messages({
      'any.required': 'Invite code is required'
    })
});

export const searchGroupsSchema = Joi.object({
  query: Joi.string().min(2).required()
    .messages({
      'string.min': 'Search query must be at least 2 characters'
    })
});