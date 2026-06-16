"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiptController = exports.ReceiptController = void 0;
const receipt_service_1 = require("./receipt.service");
class ReceiptController {
    async uploadReceipt(req, res, next) {
        try {
            const receipt = await receipt_service_1.receiptService.uploadReceipt(req.user.userId, req.file);
            const response = {
                success: true,
                message: 'Receipt uploaded successfully',
                data: receipt,
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    async getUserReceipts(req, res, next) {
        try {
            const receipts = await receipt_service_1.receiptService.getUserReceipts(req.user.userId);
            const response = {
                success: true,
                message: 'Receipts retrieved successfully',
                data: receipts,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    async getReceipt(req, res, next) {
        try {
            const receipt = await receipt_service_1.receiptService.getReceipt(req.params.receiptId, req.user.userId);
            const response = {
                success: true,
                message: 'Receipt retrieved successfully',
                data: receipt,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    async updateReceipt(req, res, next) {
        try {
            const receipt = await receipt_service_1.receiptService.updateReceipt(req.params.receiptId, req.user.userId, req.body);
            const response = {
                success: true,
                message: 'Receipt updated successfully',
                data: receipt,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    async deleteReceipt(req, res, next) {
        try {
            await receipt_service_1.receiptService.deleteReceipt(req.params.receiptId, req.user.userId);
            const response = {
                success: true,
                message: 'Receipt deleted successfully',
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    async reprocessReceipt(req, res, next) {
        try {
            const result = await receipt_service_1.receiptService.reprocessReceipt(req.params.receiptId, req.user.userId);
            const response = {
                success: true,
                message: 'Receipt reprocessing started',
                data: result,
                timestamp: new Date().toISOString()
            };
            res.status(202).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    async convertToExpense(req, res, next) {
        try {
            const expense = await receipt_service_1.receiptService.convertToExpense(req.params.receiptId, req.user.userId, req.body.groupId);
            const response = {
                success: true,
                message: 'Receipt converted to expense successfully',
                data: expense,
                timestamp: new Date().toISOString()
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ReceiptController = ReceiptController;
exports.receiptController = new ReceiptController();
//# sourceMappingURL=receipt.controller.js.map