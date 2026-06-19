"use strict";
// import { Request, Response, NextFunction } from 'express';
// import { settlementService } from './settlement.service';
// import { AuthenticatedRequest, ApiResponse } from '../../shared/types/common.types';
// import { ValidationError } from '../../shared/errors/AppError';
// import Joi from 'joi';
// const createSettlementSchema = Joi.object({
//   groupId: Joi.string().required(),
//   toUser: Joi.string().required(),
//   amount: Joi.number().positive().required(),
//   paymentMethod: Joi.string().required(),
//   notes: Joi.string().optional()
// });
// const processPaymentSchema = Joi.object({
//   transactionId: Joi.string().required(),
//   paymentGateway: Joi.string().required()
// });
// export class SettlementController {
//   /**
//    * Get simplified debts
//    */
//   async getSimplifiedDebts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { groupId } = req.params;
//       const debts = await settlementService.getSimplifiedDebts(groupId, req.user!.userId);
//       const response: ApiResponse = {
//         success: true,
//         message: 'Simplified debts retrieved successfully',
//         data: debts,
//         timestamp: new Date().toISOString()
//       };
//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }
//   /**
//    * Get debt summary for user
//    */
//   async getDebtSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { groupId } = req.params;
//       const summary = await settlementService.getDebtSummary(groupId, req.user!.userId);
//       const response: ApiResponse = {
//         success: true,
//         message: 'Debt summary retrieved successfully',
//         data: summary,
//         timestamp: new Date().toISOString()
//       };
//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }
//   /**
//    * Create settlement
//    */
//   async createSettlement(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { error, value } = createSettlementSchema.validate(req.body);
//       if (error) {
//         throw new ValidationError(error.details[0].message, error.details);
//       }
//       const settlement = await settlementService.createSettlement(
//         value.groupId,
//         req.user!.userId,
//         value.toUser,
//         value.amount,
//         value.paymentMethod,
//         req.user!.userId
//       );
//       const response: ApiResponse = {
//         success: true,
//         message: 'Settlement created successfully',
//         data: { settlement },
//         timestamp: new Date().toISOString()
//       };
//       res.status(201).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }
//   /**
//    * Process payment
//    */
//   async processPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { settlementId } = req.params;
//       const { error, value } = processPaymentSchema.validate(req.body);
//       if (error) {
//         throw new ValidationError(error.details[0].message, error.details);
//       }
//       const settlement = await settlementService.processPayment(
//         settlementId,
//         value,
//         req.user!.userId
//       );
//       const response: ApiResponse = {
//         success: true,
//         message: 'Payment processed successfully',
//         data: { settlement },
//         timestamp: new Date().toISOString()
//       };
//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }
//   /**
//    * Cancel settlement
//    */
//   async cancelSettlement(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { settlementId } = req.params;
//       const settlement = await settlementService.cancelSettlement(settlementId, req.user!.userId);
//       const response: ApiResponse = {
//         success: true,
//         message: 'Settlement cancelled successfully',
//         data: { settlement },
//         timestamp: new Date().toISOString()
//       };
//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }
//   /**
//    * Get settlement history
//    */
//   async getSettlementHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
//     try {
//       const { groupId } = req.params;
//       const { page, limit } = req.query;
//       const result = await settlementService.getSettlementHistory(
//         groupId,
//         req.user!.userId,
//         { page: Number(page) || 1, limit: Number(limit) || 20 }
//       );
//       const response: ApiResponse = {
//         success: true,
//         message: 'Settlement history retrieved successfully',
//         data: result,
//         timestamp: new Date().toISOString()
//       };
//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   }
// }
// export const settlementController = new SettlementController();
//# sourceMappingURL=settlement.controller.js.map