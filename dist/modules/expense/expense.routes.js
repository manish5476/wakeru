"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const expense_controller_1 = require("./expense.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.AuthMiddleware.authenticate);
// Expense CRUD
router.post('/', expense_controller_1.expenseController.createExpense.bind(expense_controller_1.expenseController));
router.get('/user', expense_controller_1.expenseController.getUserExpenses.bind(expense_controller_1.expenseController));
router.get('/:expenseId', expense_controller_1.expenseController.getExpenseById.bind(expense_controller_1.expenseController));
router.put('/:expenseId', expense_controller_1.expenseController.updateExpense.bind(expense_controller_1.expenseController));
router.delete('/:expenseId', expense_controller_1.expenseController.deleteExpense.bind(expense_controller_1.expenseController));
// Group expenses
router.get('/group/:groupId', expense_controller_1.expenseController.getGroupExpenses.bind(expense_controller_1.expenseController));
exports.default = router;
//# sourceMappingURL=expense.routes.js.map