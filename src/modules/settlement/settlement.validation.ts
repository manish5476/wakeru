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
});

export const confirmPaymentSchema = z.object({
  transactionId: mongoId,
});

export const disputePaymentSchema = z.object({
  transactionId: mongoId,
  reason: z.string().max(500).optional(),
});

// ============================================================
// INFERRED TYPES
// ============================================================

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;