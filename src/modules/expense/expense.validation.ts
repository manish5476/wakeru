import Joi from 'joi';

export const createExpenseSchema = Joi.object({
  groupId: Joi.string().required()
    .messages({ 'any.required': 'Group ID is required' }),
  description: Joi.string().trim().min(1).max(200).required()
    .messages({ 'any.required': 'Description is required' }),
  category: Joi.string().required()
    .messages({ 'any.required': 'Category is required' }),
  currency: Joi.string().valid('INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'SAR').default('INR'),
  
  lineItems: Joi.array().items(Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    category: Joi.string().required(),
    basePrice: Joi.number().positive().required()
      .messages({ 'number.positive': 'Price must be greater than 0' }),
    quantity: Joi.number().integer().min(1).default(1),
    consumers: Joi.array().items(Joi.object({
      userId: Joi.string().required(),
      consumptionPercentage: Joi.number().min(0).max(100).required(),
      quantity: Joi.number().integer().min(1).optional(),
      notes: Joi.string().max(100).optional()
    })).min(1).required()
  })).min(1).required()
    .messages({ 'array.min': 'At least one line item is required' }),
  
  taxes: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    percentage: Joi.number().min(0).max(100).required(),
    applicableTo: Joi.string().valid('all', 'specific').required(),
    applicableItems: Joi.array().items(Joi.string()).optional(),
    taxCode: Joi.string().optional()
  })).optional(),
  
  discounts: Joi.array().items(Joi.object({
    type: Joi.string().valid('percentage', 'fixed').required(),
    value: Joi.number().positive().required(),
    code: Joi.string().optional(),
    description: Joi.string().optional(),
    applicableTo: Joi.string().valid('all', 'specific').required(),
    applicableItems: Joi.array().items(Joi.string()).optional()
  })).optional(),
  
  paidBy: Joi.string().required()
    .messages({ 'any.required': 'Payer is required' }),
  paymentMethod: Joi.string().required()
    .messages({ 'any.required': 'Payment method is required' }),
  paymentDate: Joi.date().iso().optional()
});

export const updateExpenseSchema = Joi.object({
  description: Joi.string().trim().min(1).max(200).optional(),
  category: Joi.string().optional(),
  lineItems: Joi.array().items(Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    category: Joi.string().optional(),
    basePrice: Joi.number().positive().optional(),
    quantity: Joi.number().integer().min(1).optional(),
    consumers: Joi.array().items(Joi.object({
      userId: Joi.string().required(),
      consumptionPercentage: Joi.number().min(0).max(100).required()
    })).min(1).optional()
  })).min(1).optional(),
  
  taxes: Joi.array().items(Joi.object({
    name: Joi.string().optional(),
    percentage: Joi.number().min(0).max(100).optional(),
    applicableTo: Joi.string().valid('all', 'specific').optional(),
    applicableItems: Joi.array().items(Joi.string()).optional()
  })).optional(),
  
  discounts: Joi.array().items(Joi.object({
    type: Joi.string().valid('percentage', 'fixed').optional(),
    value: Joi.number().positive().optional(),
    applicableTo: Joi.string().valid('all', 'specific').optional(),
    applicableItems: Joi.array().items(Joi.string()).optional()
  })).optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

export const getExpensesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  category: Joi.string().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  sortBy: Joi.string().valid('createdAt', 'totalAmount', 'category').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});