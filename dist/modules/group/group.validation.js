"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchGroupsSchema = exports.joinByInviteSchema = exports.updateMemberRoleSchema = exports.addMemberSchema = exports.updateGroupSchema = exports.createGroupSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createGroupSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(100).required()
        .messages({
        'any.required': 'Group name is required',
        'string.max': 'Group name cannot exceed 100 characters'
    }),
    description: joi_1.default.string().max(500).optional(),
    type: joi_1.default.string().valid('TRIP', 'HOUSEHOLD', 'TEAM', 'EVENT', 'PROJECT', 'CUSTOM').required()
        .messages({
        'any.required': 'Group type is required',
        'any.only': 'Invalid group type'
    }),
    avatar: joi_1.default.string().uri().optional(),
    settings: joi_1.default.object({
        defaultCurrency: joi_1.default.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').optional(),
        defaultSplitType: joi_1.default.string().valid('EQUAL', 'PROPORTIONAL').optional(),
        enableReceiptScanning: joi_1.default.boolean().optional(),
        enableAutoSettlement: joi_1.default.boolean().optional(),
        settlementThreshold: joi_1.default.number().min(0).optional(),
        categories: joi_1.default.array().items(joi_1.default.string()).optional(),
        customCategories: joi_1.default.array().items(joi_1.default.string()).optional()
    }).optional(),
    memberIds: joi_1.default.array().items(joi_1.default.string()).max(50).optional()
        .messages({
        'array.max': 'Maximum 50 members allowed'
    })
});
exports.updateGroupSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(100).optional(),
    description: joi_1.default.string().max(500).optional().allow(''),
    avatar: joi_1.default.string().uri().optional().allow(''),
    settings: joi_1.default.object({
        defaultCurrency: joi_1.default.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').optional(),
        defaultSplitType: joi_1.default.string().valid('EQUAL', 'PROPORTIONAL').optional(),
        enableReceiptScanning: joi_1.default.boolean().optional(),
        enableAutoSettlement: joi_1.default.boolean().optional(),
        settlementThreshold: joi_1.default.number().min(0).optional(),
        categories: joi_1.default.array().items(joi_1.default.string()).optional(),
        customCategories: joi_1.default.array().items(joi_1.default.string()).optional()
    }).optional()
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});
exports.addMemberSchema = joi_1.default.object({
    userId: joi_1.default.string().required()
        .messages({
        'any.required': 'User ID is required'
    }),
    role: joi_1.default.string().valid('ADMIN', 'MEMBER', 'VIEWER').default('MEMBER')
});
exports.updateMemberRoleSchema = joi_1.default.object({
    role: joi_1.default.string().valid('ADMIN', 'MEMBER', 'VIEWER').required()
        .messages({
        'any.required': 'Role is required',
        'any.only': 'Invalid role'
    })
});
exports.joinByInviteSchema = joi_1.default.object({
    inviteCode: joi_1.default.string().required()
        .messages({
        'any.required': 'Invite code is required'
    })
});
exports.searchGroupsSchema = joi_1.default.object({
    query: joi_1.default.string().min(2).required()
        .messages({
        'string.min': 'Search query must be at least 2 characters'
    })
});
//# sourceMappingURL=group.validation.js.map