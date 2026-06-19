"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// Import all named exports from the controller as a single object
const expenseController = __importStar(require("./expense.controller"));
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.AuthMiddleware.authenticate);
// ─────────────────────────────────────────────────────────────────────────────
// SPECIFIC ROUTES 
// (Must come BEFORE /:expenseId to prevent Express from treating "mine" or "stop" as an ID)
// ─────────────────────────────────────────────────────────────────────────────
// All expenses paid by the current user across all trips
router.get('/mine', expenseController.getMyExpenses);
// List expenses for a specific stop
router.get('/stop/:stopId', expenseController.getStopExpenses);
// List ALL expenses across all stops for a trip
router.get('/trip/:tripId', expenseController.getTripExpenses);
// ─────────────────────────────────────────────────────────────────────────────
// STANDARD CRUD & PARAMETERIZED ROUTES
// ─────────────────────────────────────────────────────────────────────────────
// Create a new expense
router.post('/', expenseController.createExpense);
// Get a single expense with full split breakdown
router.get('/:expenseId', expenseController.getExpense);
// Update an expense (Note: PATCH instead of PUT based on your JSDoc)
router.patch('/:expenseId', expenseController.updateExpense);
// Delete expense
router.delete('/:expenseId', expenseController.deleteExpense);
// Mark one member's split as paid
router.patch('/:expenseId/splits/:userId/pay', expenseController.markSplitPaid);
exports.default = router; // import { Router } from 'express';
// import { expenseController } from './expense.controller';
// import { AuthMiddleware } from '../auth/auth.middleware';
// const router = Router();
// // All routes require authentication
// router.use(AuthMiddleware.authenticate);
// // Expense CRUD
// router.post('/', expenseController.createExpense.bind(expenseController));
// router.get('/user', expenseController.getUserExpenses.bind(expenseController));
// router.get('/:expenseId', expenseController.getExpenseById.bind(expenseController));
// router.put('/:expenseId', expenseController.updateExpense.bind(expenseController));
// router.delete('/:expenseId', expenseController.deleteExpense.bind(expenseController));
// // Group expenses
// router.get('/group/:groupId', expenseController.getGroupExpenses.bind(expenseController));
// export default router;
//# sourceMappingURL=expense.routes.js.map