"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementController = exports.SettlementController = void 0;
const settlement_service_1 = require("./settlement.service");
const AppError_1 = require("../../shared/errors/AppError");
const joi_1 = __importDefault(require("joi"));
const createSettlementSchema = joi_1.default.object({
    groupId: joi_1.default.string().required(),
    toUser: joi_1.default.string().required(),
    amount: joi_1.default.number().positive().required(),
    paymentMethod: joi_1.default.string().required(),
    notes: joi_1.default.string().optional()
});
const processPaymentSchema = joi_1.default.object({
    transactionId: joi_1.default.string().required(),
    paymentGateway: joi_1.default.string().required()
});
class SettlementController {
    /**
     * Get simplified debts
     */
    async getSimplifiedDebts(req, res, next) {
        try {
            const { groupId } = req.params;
            const debts = await settlement_service_1.settlementService.getSimplifiedDebts(groupId, req.user.userId);
            const response = {
                success: true,
                message: 'Simplified debts retrieved successfully',
                data: debts,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get debt summary for user
     */
    async getDebtSummary(req, res, next) {
        try {
            const { groupId } = req.params;
            const summary = await settlement_service_1.settlementService.getDebtSummary(groupId, req.user.userId);
            const response = {
                success: true,
                message: 'Debt summary retrieved successfully',
                data: summary,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Create settlement
     */
    async createSettlement(req, res, next) {
        try {
            const { error, value } = createSettlementSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const settlement = await settlement_service_1.settlementService.createSettlement(value.groupId, req.user.userId, value.toUser, value.amount, value.paymentMethod, req.user.userId);
            const response = {
                success: true,
                message: 'Settlement created successfully',
                data: { settlement },
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Process payment
     */
    async processPayment(req, res, next) {
        try {
            const { settlementId } = req.params;
            const { error, value } = processPaymentSchema.validate(req.body);
            if (error) {
                throw new AppError_1.ValidationError(error.details[0].message, error.details);
            }
            const settlement = await settlement_service_1.settlementService.processPayment(settlementId, value, req.user.userId);
            const response = {
                success: true,
                message: 'Payment processed successfully',
                data: { settlement },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Cancel settlement
     */
    async cancelSettlement(req, res, next) {
        try {
            const { settlementId } = req.params;
            const settlement = await settlement_service_1.settlementService.cancelSettlement(settlementId, req.user.userId);
            const response = {
                success: true,
                message: 'Settlement cancelled successfully',
                data: { settlement },
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get settlement history
     */
    async getSettlementHistory(req, res, next) {
        try {
            const { groupId } = req.params;
            const { page, limit } = req.query;
            const result = await settlement_service_1.settlementService.getSettlementHistory(groupId, req.user.userId, { page: Number(page) || 1, limit: Number(limit) || 20 });
            const response = {
                success: true,
                message: 'Settlement history retrieved successfully',
                data: result,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SettlementController = SettlementController;
exports.settlementController = new SettlementController();
//# sourceMappingURL=settlement.controller.js.map