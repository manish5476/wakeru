"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiptController = exports.ReceiptController = void 0;
const receipt_service_1 = require("./receipt.service");
const AppError_1 = require("../../shared/errors/AppError");
// ============================================================
// HELPER
// ============================================================
const getUser = (req) => {
    if (!req.user?.userId)
        throw new AppError_1.AppError('Not authenticated', 401);
    return req.user.userId;
};
// ============================================================
// CONTROLLER
// ============================================================
class ReceiptController {
    async uploadReceipt(req, res, next) {
        try {
            const userId = getUser(req);
            const { tripId, expenseId } = req.body;
            const receipt = await receipt_service_1.receiptService.uploadReceipt(userId, req.file, tripId, expenseId);
            res.status(201).json({
                success: true,
                message: 'Receipt uploaded — processing started',
                data: { receipt },
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getUserReceipts(req, res, next) {
        try {
            const userId = getUser(req);
            const { page, limit, status } = req.query;
            const result = await receipt_service_1.receiptService.getUserReceipts(userId, {
                page: Number(page) || 1,
                limit: Number(limit) || 20,
                status: status,
            });
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getTripReceipts(req, res, next) {
        try {
            const { tripId } = req.params;
            const { page, limit } = req.query;
            const result = await receipt_service_1.receiptService.getTripReceipts(tripId, {
                page: Number(page) || 1,
                limit: Number(limit) || 20,
            });
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getReceipt(req, res, next) {
        try {
            const userId = getUser(req);
            const receipt = await receipt_service_1.receiptService.getReceipt(req.params.receiptId, userId);
            res.status(200).json({ success: true, data: { receipt } });
        }
        catch (error) {
            next(error);
        }
    }
    async updateReceipt(req, res, next) {
        try {
            const userId = getUser(req);
            const receipt = await receipt_service_1.receiptService.updateReceipt(req.params.receiptId, userId, req.body);
            res.status(200).json({
                success: true,
                message: 'Receipt updated',
                data: { receipt },
            });
        }
        catch (error) {
            next(error);
        }
    }
    async deleteReceipt(req, res, next) {
        try {
            const userId = getUser(req);
            await receipt_service_1.receiptService.deleteReceipt(req.params.receiptId, userId);
            res.status(200).json({
                success: true,
                message: 'Receipt deleted',
            });
        }
        catch (error) {
            next(error);
        }
    }
    async reprocessReceipt(req, res, next) {
        try {
            const userId = getUser(req);
            const result = await receipt_service_1.receiptService.reprocessReceipt(req.params.receiptId, userId);
            res.status(202).json({
                success: true,
                message: 'OCR reprocessing started',
                data: { receipt: result },
            });
        }
        catch (error) {
            next(error);
        }
    }
    async convertToExpense(req, res, next) {
        try {
            const userId = getUser(req);
            const { tripId } = req.body;
            const expenseData = await receipt_service_1.receiptService.convertToExpense(req.params.receiptId, userId, tripId);
            res.status(200).json({
                success: true,
                message: 'Receipt data ready for expense creation',
                data: { expenseData },
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ReceiptController = ReceiptController;
exports.receiptController = new ReceiptController();
//# sourceMappingURL=receipt.controller.js.map