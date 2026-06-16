"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settlement_controller_1 = require("./settlement.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.AuthMiddleware.authenticate);
// Debt management
router.get('/debts/:groupId', settlement_controller_1.settlementController.getSimplifiedDebts.bind(settlement_controller_1.settlementController));
router.get('/debts/:groupId/summary', settlement_controller_1.settlementController.getDebtSummary.bind(settlement_controller_1.settlementController));
// Settlement operations
router.post('/', settlement_controller_1.settlementController.createSettlement.bind(settlement_controller_1.settlementController));
router.post('/:settlementId/pay', settlement_controller_1.settlementController.processPayment.bind(settlement_controller_1.settlementController));
router.post('/:settlementId/cancel', settlement_controller_1.settlementController.cancelSettlement.bind(settlement_controller_1.settlementController));
// History
router.get('/history/:groupId', settlement_controller_1.settlementController.getSettlementHistory.bind(settlement_controller_1.settlementController));
exports.default = router;
//# sourceMappingURL=settlement.routes.js.map