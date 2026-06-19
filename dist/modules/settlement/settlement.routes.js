"use strict";
// import { Router, Request, Response, NextFunction } from 'express';
// import * as settlementService from './settlement.service';
// import { authenticate } from '../middleware/authenticate';
// import { AppError } from '../utils/AppError';
// const getUser = (req: Request) => {
//     const user = (req as any).user;
//     if (!user?.uid) throw new AppError('Not authenticated', 401);
//     return user as { uid: string; displayName: string };
// };
// // ─────────────────────────────────────────────────────────────────────────────
// // CONTROLLERS
// // ─────────────────────────────────────────────────────────────────────────────
// /**
//  * GET /api/v1/settlements/trip/:tripId
//  * Get current settlement plan. Recalculates if stale.
//  */
// const getSettlement = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ): Promise<void> => {
//     try {
//         const user = getUser(req);
//         const { tripId } = req.params;
//         const settlement = await settlementService.getSettlement(tripId, user.uid);
//         res.status(200).json({
//             success: true,
//             data: { settlement },
//         });
//     } catch (err) {
//         next(err);
//     }
// };
// /**
//  * POST /api/v1/settlements/trip/:tripId/calculate
//  * Force recalculate the settlement plan.
//  */
// const calculateSettlement = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ): Promise<void> => {
//     try {
//         const user = getUser(req);
//         const { tripId } = req.params;
//         const settlement = await settlementService.calculateSettlement(
//             tripId,
//             user.uid
//         );
//         res.status(200).json({
//             success: true,
//             message: 'Settlement recalculated',
//             data: { settlement },
//         });
//     } catch (err) {
//         next(err);
//     }
// };
// /**
//  * POST /api/v1/settlements/trip/:tripId/pay/:transactionId
//  * Initiate a UPI payment for a specific transaction.
//  */
// const initiatePayment = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ): Promise<void> => {
//     try {
//         const user = getUser(req);
//         const { tripId, transactionId } = req.params;
//         const result = await settlementService.initiatePayment(
//             tripId,
//             transactionId,
//             user.uid
//         );
//         res.status(200).json({
//             success: true,
//             message: 'Payment initiated',
//             data: result,
//         });
//     } catch (err) {
//         next(err);
//     }
// };
// /**
//  * POST /api/v1/settlements/trip/:tripId/confirm/:transactionId
//  * Recipient confirms they received payment.
//  */
// const confirmPayment = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ): Promise<void> => {
//     try {
//         const user = getUser(req);
//         const { tripId, transactionId } = req.params;
//         const settlement = await settlementService.confirmPayment(
//             tripId,
//             transactionId,
//             user.uid
//         );
//         res.status(200).json({
//             success: true,
//             message: 'Payment confirmed. Splits marked as paid.',
//             data: { settlement },
//         });
//     } catch (err) {
//         next(err);
//     }
// };
// /**
//  * POST /api/v1/settlements/trip/:tripId/dispute/:transactionId
//  * Flag a transaction as disputed.
//  */
// const disputePayment = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ): Promise<void> => {
//     try {
//         const user = getUser(req);
//         const { tripId, transactionId } = req.params;
//         const settlement = await settlementService.disputePayment(
//             tripId,
//             transactionId,
//             user.uid
//         );
//         res.status(200).json({
//             success: true,
//             message: 'Transaction flagged as disputed',
//             data: { settlement },
//         });
//     } catch (err) {
//         next(err);
//     }
// };
// // ─────────────────────────────────────────────────────────────────────────────
// // ROUTER
// // ─────────────────────────────────────────────────────────────────────────────
// const router = Router();
// router.use(authenticate);
// router.get('/trip/:tripId', getSettlement);
// router.post('/trip/:tripId/calculate', calculateSettlement);
// router.post('/trip/:tripId/pay/:transactionId', initiatePayment);
// router.post('/trip/:tripId/confirm/:transactionId', confirmPayment);
// router.post('/trip/:tripId/dispute/:transactionId', disputePayment);
// export default router;
// // import { Router } from 'express';
// // import { settlementController } from './settlement.controller';
// // import { AuthMiddleware } from '../auth/auth.middleware';
// // const router = Router();
// // router.use(AuthMiddleware.authenticate);
// // // Debt management
// // router.get('/debts/:groupId', settlementController.getSimplifiedDebts.bind(settlementController));
// // router.get('/debts/:groupId/summary', settlementController.getDebtSummary.bind(settlementController));
// // // Settlement operations
// // router.post('/', settlementController.createSettlement.bind(settlementController));
// // router.post('/:settlementId/pay', settlementController.processPayment.bind(settlementController));
// // router.post('/:settlementId/cancel', settlementController.cancelSettlement.bind(settlementController));
// // // History
// // router.get('/history/:groupId', settlementController.getSettlementHistory.bind(settlementController));
// // export default router;
//# sourceMappingURL=settlement.routes.js.map