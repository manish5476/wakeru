import { Request, Response, NextFunction } from 'express';
/**
 * GET /api/v1/settlements/trip/:tripId
 * Get current settlement plan (auto-calculates if needed).
 */
export declare const getSettlement: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * POST /api/v1/settlements/trip/:tripId/calculate
 * Force recalculate settlement.
 */
export declare const calculateSettlement: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * POST /api/v1/settlements/trip/:tripId/pay
 * Initiate UPI payment for a settlement transaction.
 */
export declare const initiatePayment: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * POST /api/v1/settlements/trip/:tripId/confirm
 * Confirm receipt of a payment (recipient only).
 */
export declare const confirmPayment: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * POST /api/v1/settlements/trip/:tripId/dispute
 * Dispute a payment.
 */
export declare const disputePayment: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=settlement.controller.d.ts.map