"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseController = exports.ExpenseController = void 0;
const expense_service_1 = require("./expense.service");
const expense_validation_1 = require("./expense.validation");
const AppError_1 = require("../../shared/errors/AppError");
class ExpenseController {
    /**
     * Create expense
     */
    async createExpense(req, res, next) {
        try {
            const { error, value } = expense_validation_1.createExpenseSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const expense = await expense_service_1.expenseService.createExpense(value, req.user.userId);
            const response = {
                success: true,
                message: 'Expense created successfully',
                data: { expense },
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get expense by ID
     */
    async getExpenseById(req, res, next) {
        try {
            const { expenseId } = req.params;
            const expense = await expense_service_1.expenseService.getExpenseById(expenseId, req.user.userId);
            const response = {
                success: true,
                message: 'Expense retrieved successfully',
                data: { expense },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get group expenses
     */
    async getGroupExpenses(req, res, next) {
        try {
            const { groupId } = req.params;
            const { error, value } = expense_validation_1.getExpensesQuerySchema.validate(req.query);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const result = await expense_service_1.expenseService.getGroupExpenses(groupId, req.user.userId, value);
            const response = {
                success: true,
                message: 'Group expenses retrieved successfully',
                data: result,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's expenses
     */
    async getUserExpenses(req, res, next) {
        try {
            const { error, value } = expense_validation_1.getExpensesQuerySchema.validate(req.query);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const result = await expense_service_1.expenseService.getUserExpenses(req.user.userId, value);
            const response = {
                success: true,
                message: 'User expenses retrieved successfully',
                data: result,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update expense
     */
    async updateExpense(req, res, next) {
        try {
            const { expenseId } = req.params;
            const { error, value } = expense_validation_1.updateExpenseSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const expense = await expense_service_1.expenseService.updateExpense(expenseId, req.user.userId, value);
            const response = {
                success: true,
                message: 'Expense updated successfully',
                data: { expense },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete expense
     */
    async deleteExpense(req, res, next) {
        try {
            const { expenseId } = req.params;
            await expense_service_1.expenseService.deleteExpense(expenseId, req.user.userId);
            const response = {
                success: true,
                message: 'Expense deleted successfully',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ExpenseController = ExpenseController;
exports.expenseController = new ExpenseController();
//# sourceMappingURL=expense.controller.js.map