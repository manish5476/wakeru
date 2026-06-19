"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const receipt_controller_1 = require("./receipt.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid file type: ${file.mimetype}`));
        }
    },
});
// All routes require authentication
router.use(auth_middleware_1.protect);
// Upload
router.post('/upload', upload.single('receipt'), receipt_controller_1.receiptController.uploadReceipt.bind(receipt_controller_1.receiptController));
// User's receipts
router.get('/', receipt_controller_1.receiptController.getUserReceipts.bind(receipt_controller_1.receiptController));
// Trip receipts
router.get('/trip/:tripId', receipt_controller_1.receiptController.getTripReceipts.bind(receipt_controller_1.receiptController));
// Single receipt CRUD
router.get('/:receiptId', receipt_controller_1.receiptController.getReceipt.bind(receipt_controller_1.receiptController));
router.put('/:receiptId', receipt_controller_1.receiptController.updateReceipt.bind(receipt_controller_1.receiptController));
router.delete('/:receiptId', receipt_controller_1.receiptController.deleteReceipt.bind(receipt_controller_1.receiptController));
// OCR operations
router.post('/:receiptId/reprocess', receipt_controller_1.receiptController.reprocessReceipt.bind(receipt_controller_1.receiptController));
router.post('/:receiptId/convert', receipt_controller_1.receiptController.convertToExpense.bind(receipt_controller_1.receiptController));
exports.default = router;
//# sourceMappingURL=receipt.routes.js.map