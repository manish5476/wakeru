import { ISettlement, ISettlementTransaction } from './settlement.model';
interface NetBalance {
    userId: string;
    displayName: string;
    amount: number;
}
interface MinTransaction {
    from: string;
    fromName: string;
    to: string;
    toName: string;
    amount: number;
}
/**
 * Greedy minimum-transaction settlement algorithm.
 *
 * For N people: max N-1 transfers (instead of O(N²) naive).
 * Example: 8 friends, 47 expenses → max 7 transfers.
 *
 * Algorithm:
 * 1. Compute net balance per person
 * 2. Split into creditors (+) and debtors (-)
 * 3. Greedily match largest creditor with largest debtor
 */
export declare const computeMinimumTransactions: (balances: NetBalance[]) => MinTransaction[];
/**
 * Calculate the current settlement plan for a trip.
 *
 * Flow:
 * 1. Load all unsettled, non-archived expenses for the trip
 * 2. Compute net balance per member (in baseCurrency)
 * 3. Run min-transaction algorithm
 * 4. Upsert Settlement document — preserving in-flight transaction status
 *    for any (from, to) pair that already exists, so an unrelated new
 *    expense elsewhere in the trip doesn't wipe out someone's already-
 *    initiated or confirmed payment.
 */
export declare const calculateSettlement: (tripId: string, requestingUid: string) => Promise<ISettlement>;
/**
 * Get current settlement for a trip.
 * Auto-recalculates if missing or stale.
 */
export declare const getSettlement: (tripId: string, requestingUid: string) => Promise<ISettlement>;
/**
 * Mark settlement as stale when expenses change.
 * Called by Expense service after create/update/delete.
 */
export declare const markSettlementStale: (tripId: string) => Promise<void>;
/**
 * Initiate a UPI payment for a settlement transaction.
 * Generates UPI deep link and marks transaction as 'initiated'.
 *
 * UPI deep link format:
 * upi://pay?pa=vpa@bank&pn=Name&am=Amount&cu=INR&tn=Note
 */
export declare const initiatePayment: (tripId: string, transactionId: string, fromUid: string) => Promise<{
    transaction: ISettlementTransaction;
    upiDeepLink: string;
}>;
/**
 * Confirm receipt of a payment.
 * Only the recipient can confirm.
 * Marks all relevant expense splits as paid.
 *
 * KNOWN LIMITATION: this settlement transaction is a *netted* transfer
 * from the minimum-transaction algorithm, not necessarily a direct debt
 * from an original expense. If the algorithm rerouted debt through a third
 * person (A owes B, B owes C → a single A→C transfer), there may be no
 * expense where `paidBy: to` and `splits.userId: from` (or vice versa)
 * exist at all — the updateMany calls below will simply match nothing,
 * and the underlying Expense.isSettled state will drift from the
 * Settlement's view of "confirmed". This works correctly for the common
 * 2-person-debt case but isn't a full reconciliation. A more robust fix is
 * to record confirmed settlement payments as their own ledger entries that
 * offset future balance calculations, rather than retroactively mutating
 * old expense splits — worth doing as a follow-up if multi-hop netting is
 * common in your trips.
 */
export declare const confirmPayment: (tripId: string, transactionId: string, confirmingUid: string) => Promise<ISettlement>;
/**
 * Dispute a payment.
 * Either participant can dispute.
 */
export declare const disputePayment: (tripId: string, transactionId: string, requestingUid: string) => Promise<ISettlement>;
export declare const settlementService: {
    calculateSettlement: (tripId: string, requestingUid: string) => Promise<ISettlement>;
    getSettlement: (tripId: string, requestingUid: string) => Promise<ISettlement>;
    markSettlementStale: (tripId: string) => Promise<void>;
    initiatePayment: (tripId: string, transactionId: string, fromUid: string) => Promise<{
        transaction: ISettlementTransaction;
        upiDeepLink: string;
    }>;
    confirmPayment: (tripId: string, transactionId: string, confirmingUid: string) => Promise<ISettlement>;
    disputePayment: (tripId: string, transactionId: string, requestingUid: string) => Promise<ISettlement>;
    computeMinimumTransactions: (balances: NetBalance[]) => MinTransaction[];
};
export {};
//# sourceMappingURL=settlement.service.d.ts.map