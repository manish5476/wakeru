"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpensesQuerySchema = exports.updateExpenseSchema = exports.createExpenseSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createExpenseSchema = joi_1.default.object({
    groupId: joi_1.default.string().required()
        .messages({ 'any.required': 'Group ID is required' }),
    description: joi_1.default.string().trim().min(1).max(200).required()
        .messages({ 'any.required': 'Description is required' }),
    category: joi_1.default.string().required()
        .messages({ 'any.required': 'Category is required' }),
    currency: joi_1.default.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').default('INR'),
    lineItems: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).required(),
        category: joi_1.default.string().required(),
        basePrice: joi_1.default.number().positive().required()
            .messages({ 'number.positive': 'Price must be greater than 0' }),
        quantity: joi_1.default.number().integer().min(1).default(1),
        consumers: joi_1.default.array().items(joi_1.default.object({
            userId: joi_1.default.string().required(),
            consumptionPercentage: joi_1.default.number().min(0).max(100).required(),
            quantity: joi_1.default.number().integer().min(1).optional(),
            notes: joi_1.default.string().max(100).optional()
        })).min(1).required()
    })).min(1).required()
        .messages({ 'array.min': 'At least one line item is required' }),
    taxes: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().required(),
        percentage: joi_1.default.number().min(0).max(100).required(),
        applicableTo: joi_1.default.string().valid('all', 'specific').required(),
        applicableItems: joi_1.default.array().items(joi_1.default.string()).optional(),
        taxCode: joi_1.default.string().optional()
    })).optional(),
    discounts: joi_1.default.array().items(joi_1.default.object({
        type: joi_1.default.string().valid('percentage', 'fixed').required(),
        value: joi_1.default.number().positive().required(),
        code: joi_1.default.string().optional(),
        description: joi_1.default.string().optional(),
        applicableTo: joi_1.default.string().valid('all', 'specific').required(),
        applicableItems: joi_1.default.array().items(joi_1.default.string()).optional()
    })).optional(),
    paidBy: joi_1.default.string().required()
        .messages({ 'any.required': 'Payer is required' }),
    paymentMethod: joi_1.default.string().required()
        .messages({ 'any.required': 'Payment method is required' }),
    paymentDate: joi_1.default.date().iso().optional()
});
exports.updateExpenseSchema = joi_1.default.object({
    description: joi_1.default.string().trim().min(1).max(200).optional(),
    category: joi_1.default.string().optional(),
    lineItems: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(100).optional(),
        category: joi_1.default.string().optional(),
        basePrice: joi_1.default.number().positive().optional(),
        quantity: joi_1.default.number().integer().min(1).optional(),
        consumers: joi_1.default.array().items(joi_1.default.object({
            userId: joi_1.default.string().required(),
            consumptionPercentage: joi_1.default.number().min(0).max(100).required()
        })).min(1).optional()
    })).min(1).optional(),
    taxes: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().optional(),
        percentage: joi_1.default.number().min(0).max(100).optional(),
        applicableTo: joi_1.default.string().valid('all', 'specific').optional(),
        applicableItems: joi_1.default.array().items(joi_1.default.string()).optional()
    })).optional(),
    discounts: joi_1.default.array().items(joi_1.default.object({
        type: joi_1.default.string().valid('percentage', 'fixed').optional(),
        value: joi_1.default.number().positive().optional(),
        applicableTo: joi_1.default.string().valid('all', 'specific').optional(),
        applicableItems: joi_1.default.array().items(joi_1.default.string()).optional()
    })).optional()
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});
exports.getExpensesQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    category: joi_1.default.string().optional(),
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().optional(),
    sortBy: joi_1.default.string().valid('createdAt', 'totalAmount', 'category').default('createdAt'),
    sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc')
});
//# sourceMappingURL=expense.validation.js.map