import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');
const firebaseUid = z.string().min(1, 'User ID is required').max(128);

// ============================================================
// PARAM SCHEMAS
// ============================================================

export const tripSettlementParamSchema = z.object({
  tripId: mongoId,
});

export const transactionParamSchema = z.object({
  tripId: mongoId,
  transactionId: mongoId,
});

// ============================================================
// BODY SCHEMAS
// ============================================================

export const initiatePaymentSchema = z.object({
  transactionId: mongoId,
  partialAmount: z.number().positive('Amount must be positive').optional(),
});

export const confirmPaymentSchema = z.object({
  transactionId: mongoId,
  notes: z.string().max(500).optional(),
});

export const confirmTransactionBodySchema = z.object({
  notes: z.string().max(500).optional(),
});

export const disputePaymentSchema = z.object({
  transactionId: mongoId,
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
});

export const retryPaymentSchema = z.object({
  transactionId: mongoId,
});

export const settleAllSchema = z.object({});

export const settleSelectedSchema = z.object({
  transactionIds: z
    .array(mongoId, { required_error: 'transactionIds is required' })
    .min(1, 'At least one transaction ID is required'),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
});

// ============================================================
// QUERY SCHEMAS
// ============================================================

export const settlementQuerySchema = z.object({
  status: z.enum(['pending', 'initiated', 'confirmed', 'disputed', 'rejected']).optional(),
  fromUserId: firebaseUid.optional(),
  toUserId: firebaseUid.optional(),
});

// ============================================================
// INFERRED TYPES
// ============================================================

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type DisputePaymentInput = z.infer<typeof disputePaymentSchema>;
export type RetryPaymentInput = z.infer<typeof retryPaymentSchema>;
export type SettleSelectedInput = z.infer<typeof settleSelectedSchema>;
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;
export type SettlementQuery = z.infer<typeof settlementQuerySchema>;