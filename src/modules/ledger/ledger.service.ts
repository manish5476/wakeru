import { Types } from 'mongoose';
import { User } from '../auth/auth.model';
import { Trip } from '../trips/trip.model';
import { Expense } from '../expense/expense.model';
import { Settlement } from '../settlement/settlement.model';
import { logger } from '../../config/logger';

// ============================================================
// CANONICAL FINANCIAL LEDGER SERVICE
// ============================================================
// One Authoritative Source of Truth for all financial balances,
// splits, settlements, and ledger reconciliations in Wakeru.
// ============================================================

export interface CanonicalUserIdentity {
  canonicalId: string;
  firebaseUid?: string;
  mongoId?: string;
  email?: string;
  displayName: string;
}

export interface CounterpartyBalance {
  counterpartyId: string;
  counterpartyName: string;
  counterpartyEmail?: string;
  grossYouOwe: number;
  grossTheyOwe: number;
  settledPaid: number;
  settledReceived: number;
  netAmount: number; // positive = you owe them; negative = they owe you
  direction: 'you_owe' | 'owes_you' | 'settled';
  status: 'pending' | 'partially_paid' | 'paid';
  tripIds: string[];
}

export interface AuthoritativeBalances {
  // Aggregate Metrics
  totalTripSpend: number;
  totalPaid: number;
  myShare: number;
  
  // Gross Split Metrics (Raw splits before bilateral netting)
  grossOwedToYou: number;
  grossYouOwe: number;
  
  // Netted Settlement Positions (Authoritative after debt simplification)
  netReceivable: number;
  netPayable: number;
  
  // Net Position (Positive = you are owed; Negative = you owe)
  netBalance: number;
  
  // Status & Counts
  status: 'in_credit' | 'in_debt' | 'settled';
  pendingSettlementCount: number;
  activeOutgoingPaymentsCount: number;
  
  baseCurrency: string;
  counterparties: CounterpartyBalance[];
}

export interface BalanceBreakdown {
  openingBalance: number;
  totalPaidByUser: number;
  userShareOfExpenses: number;
  amountOthersOweUser: number;
  amountUserOwesOthers: number;
  settledPaid: number;
  settledReceived: number;
  netBalance: number;
  formula: string;
  counterparties: CounterpartyBalance[];
}

export class LedgerService {
  /**
   * Helper: Convert monetary amount to integer cents/paise for decimal safety.
   */
  public static toCents(amount: number): number {
    if (!amount || isNaN(amount)) return 0;
    return Math.round(amount * 100);
  }

  /**
   * Helper: Convert integer cents/paise back to two-decimal currency float.
   */
  public static fromCents(cents: number): number {
    return parseFloat((cents / 100).toFixed(2));
  }

  /**
   * Resolves any user ID (whether Firebase UID or MongoDB ObjectId) to a unified canonical identity.
   */
  public static async resolveUserIdentities(rawIds: string[]): Promise<Map<string, CanonicalUserIdentity>> {
    const uniqueIds = Array.from(new Set(rawIds.filter(Boolean)));
    const identityMap = new Map<string, CanonicalUserIdentity>();

    if (uniqueIds.length === 0) return identityMap;

    const validObjectIds = uniqueIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const stringUids = uniqueIds.filter((id) => !Types.ObjectId.isValid(id) || id.length !== 24);

    const orClauses: any[] = [];
    if (stringUids.length > 0) {
      orClauses.push({ firebaseUid: { $in: uniqueIds } });
    }
    if (validObjectIds.length > 0) {
      orClauses.push({ _id: { $in: validObjectIds } });
    }

    const users = orClauses.length > 0
      ? await User.find({ $or: orClauses }).select('_id firebaseUid email displayName').lean()
      : [];

    for (const u of users) {
      const canonicalId = (u as any).firebaseUid || String(u._id);
      const identity: CanonicalUserIdentity = {
        canonicalId,
        firebaseUid: (u as any).firebaseUid,
        mongoId: String(u._id),
        email: u.email,
        displayName: u.displayName || 'Unknown User',
      };

      if ((u as any).firebaseUid) {
        identityMap.set((u as any).firebaseUid, identity);
      }
      if (u._id) {
        identityMap.set(String(u._id), identity);
      }
    }

    // Fallback for any ID not found in database
    for (const id of uniqueIds) {
      if (!identityMap.has(id)) {
        identityMap.set(id, {
          canonicalId: id,
          displayName: 'User',
        });
      }
    }

    return identityMap;
  }

  /**
   * Deterministically checks whether two user IDs represent the exact same person.
   */
  public static areSameUser(
    idA?: string | null,
    idB?: string | null,
    identityMap?: Map<string, CanonicalUserIdentity>
  ): boolean {
    if (!idA || !idB) return false;
    const cleanA = String(idA).trim();
    const cleanB = String(idB).trim();
    if (!cleanA || !cleanB) return false;
    if (cleanA.toLowerCase() === cleanB.toLowerCase()) return true;

    if (identityMap) {
      const userA = identityMap.get(cleanA) || identityMap.get(idA);
      const userB = identityMap.get(cleanB) || identityMap.get(idB);
      if (userA && userB) {
        const canonicalMatch = Boolean(userA.canonicalId && userB.canonicalId && userA.canonicalId.toLowerCase() === userB.canonicalId.toLowerCase());
        const emailMatch = Boolean(userA.email && userB.email && userA.email.toLowerCase() === userB.email.toLowerCase());
        return canonicalMatch || emailMatch;
      }
    }
    return false;
  }

  /**
   * Computes the authoritative financial balances for a user across all active trips.
   * This is the single canonical engine used by Dashboard, Settlements, and Analytics.
   */
  public static async getAuthoritativeBalances(
    userId: string,
    specificTripId?: string
  ): Promise<AuthoritativeBalances> {
    const identityMap = await this.resolveUserIdentities([userId]);
    const selfIdentity = identityMap.get(userId);
    const selfCanonicalId = selfIdentity?.canonicalId || userId;
    const selfFirebaseUid = selfIdentity?.firebaseUid;
    const selfMongoId = selfIdentity?.mongoId;

    // Helper to test if an ID belongs to current user
    const isSelf = (testId?: string | null): boolean => {
      if (!testId) return false;
      return (
        testId === selfCanonicalId ||
        (Boolean(selfFirebaseUid) && testId === selfFirebaseUid) ||
        (Boolean(selfMongoId) && testId === selfMongoId)
      );
    };

    // Find all trips the user belongs to
    const tripQuery: any = {
      isDeleted: { $ne: true },
      isArchived: false,
      members: {
        $elemMatch: {
          isActive: true,
          userId: { $in: [selfCanonicalId, selfFirebaseUid, selfMongoId].filter(Boolean) },
        },
      },
    };

    if (specificTripId) {
      tripQuery._id = new Types.ObjectId(specificTripId);
    }

    const trips = await Trip.find(tripQuery).select('_id title baseCurrency members').lean();
    const tripIds = trips.map((t) => t._id);

    if (tripIds.length === 0) {
      return {
        totalTripSpend: 0,
        totalPaid: 0,
        myShare: 0,
        grossOwedToYou: 0,
        grossYouOwe: 0,
        netReceivable: 0,
        netPayable: 0,
        netBalance: 0,
        status: 'settled',
        pendingSettlementCount: 0,
        activeOutgoingPaymentsCount: 0,
        baseCurrency: 'INR',
        counterparties: [],
      };
    }

    // Load non-archived expenses for these trips
    const expenses = await Expense.find({
      tripId: { $in: tripIds },
      isArchived: false,
    })
      .select('title amountBase localCurrency baseCurrency date category paidBy splits tripId isSettled')
      .lean();

    // Load settlements for these trips
    const settlements = await Settlement.find({
      tripId: { $in: tripIds },
    }).lean();

    // Collect all participant IDs for identity resolution
    const participantIds = new Set<string>();
    participantIds.add(userId);
    expenses.forEach((e) => {
      if (e.paidBy) participantIds.add(String(e.paidBy));
      (e.splits || []).forEach((s) => {
        if (s.userId) participantIds.add(String(s.userId));
      });
    });
    settlements.forEach((s) => {
      (s.transactions || []).forEach((t) => {
        if (t.from) participantIds.add(String(t.from));
        if (t.to) participantIds.add(String(t.to));
      });
    });

    const fullIdentityMap = await this.resolveUserIdentities(Array.from(participantIds));

    // Ledger Accumulators in Integer Cents
    let totalTripSpendCents = 0;
    let totalPaidCents = 0;
    let myShareCents = 0;
    let grossOwedToYouCents = 0;
    let grossYouOweCents = 0;

    // Bilateral Debt Trackers per Counterparty (canonicalId -> state)
    interface BilateralState {
      canonicalId: string;
      displayName: string;
      email?: string;
      youOweCents: number;
      theyOweCents: number;
      settledPaidCents: number;
      settledReceivedCents: number;
      tripIds: Set<string>;
    }
    const counterpartiesMap = new Map<string, BilateralState>();

    const getCounterparty = (id: string): BilateralState => {
      const idInfo = fullIdentityMap.get(id);
      const cId = idInfo?.canonicalId || id;
      if (!counterpartiesMap.has(cId)) {
        counterpartiesMap.set(cId, {
          canonicalId: cId,
          displayName: idInfo?.displayName || 'Traveler',
          email: idInfo?.email,
          youOweCents: 0,
          theyOweCents: 0,
          settledPaidCents: 0,
          settledReceivedCents: 0,
          tripIds: new Set<string>(),
        });
      }
      return counterpartiesMap.get(cId)!;
    };

    // 1. Process Expenses
    for (const exp of expenses) {
      const expAmountCents = this.toCents(exp.amountBase || 0);
      totalTripSpendCents += expAmountCents;

      const payerIsMe = isSelf(exp.paidBy);
      const tripIdStr = String(exp.tripId);

      if (payerIsMe) {
        totalPaidCents += expAmountCents;
      }

      for (const split of exp.splits || []) {
        const splitAmountCents = this.toCents(split.amountBase || 0);
        const splitIsMe = isSelf(split.userId);

        if (splitIsMe) {
          myShareCents += splitAmountCents;
        }

        // Bilateral Debts: Only generate debt when payer and split participant are DIFFERENT people!
        const isSelfSplit = isSelf(split.userId) && isSelf(exp.paidBy);
        if (isSelfSplit) {
          // Self-debt is impossible. Payer paid their own share.
          continue;
        }

        if (payerIsMe && !splitIsMe) {
          // Others owe me
          const cp = getCounterparty(split.userId);
          cp.tripIds.add(tripIdStr);
          cp.theyOweCents += splitAmountCents;
          grossOwedToYouCents += splitAmountCents;
        } else if (!payerIsMe && splitIsMe) {
          // I owe the payer
          const cp = getCounterparty(exp.paidBy);
          cp.tripIds.add(tripIdStr);
          cp.youOweCents += splitAmountCents;
          grossYouOweCents += splitAmountCents;
        }
      }
    }

    // 2. Process Settlement Transactions
    let pendingCount = 0;
    let activeOutgoingCount = 0;

    for (const s of settlements) {
      for (const txn of s.transactions || []) {
        const fromMe = isSelf(txn.from);
        const toMe = isSelf(txn.to);

        // Guard against any corrupt self-settlements
        if (fromMe && toMe) {
          continue;
        }

        const txnAmountCents = this.toCents(txn.amountBase || 0);
        const isConfirmed = txn.status === 'confirmed';
        const isPending = txn.status === 'pending' || txn.status === 'initiated';

        if (fromMe && isPending) {
          pendingCount++;
          activeOutgoingCount++;
        } else if (toMe && isPending) {
          pendingCount++;
        }

        if (fromMe && !toMe) {
          const cp = getCounterparty(txn.to);
          if (isConfirmed) {
            cp.settledPaidCents += txnAmountCents;
          }
        } else if (!fromMe && toMe) {
          const cp = getCounterparty(txn.from);
          if (isConfirmed) {
            cp.settledReceivedCents += txnAmountCents;
          }
        }
      }
    }

    // 3. Compute Net Bilateral Balances
    let netReceivableCents = 0;
    let netPayableCents = 0;
    const counterpartyResults: CounterpartyBalance[] = [];

    for (const cp of counterpartiesMap.values()) {
      // Net Formula for counterparty:
      // What you owe them net = (Gross you owe - Settled you paid) - (Gross they owe - Settled they paid)
      const remainingYouOwe = Math.max(0, cp.youOweCents - cp.settledPaidCents);
      const remainingTheyOwe = Math.max(0, cp.theyOweCents - cp.settledReceivedCents);
      const netCents = remainingYouOwe - remainingTheyOwe;

      if (Math.abs(netCents) < 5) {
        // Settled within 5 cents / paise tolerance
        counterpartyResults.push({
          counterpartyId: cp.canonicalId,
          counterpartyName: cp.displayName,
          counterpartyEmail: cp.email,
          grossYouOwe: this.fromCents(cp.youOweCents),
          grossTheyOwe: this.fromCents(cp.theyOweCents),
          settledPaid: this.fromCents(cp.settledPaidCents),
          settledReceived: this.fromCents(cp.settledReceivedCents),
          netAmount: 0,
          direction: 'settled',
          status: 'paid',
          tripIds: Array.from(cp.tripIds),
        });
      } else if (netCents > 0) {
        // You owe them
        netPayableCents += netCents;
        counterpartyResults.push({
          counterpartyId: cp.canonicalId,
          counterpartyName: cp.displayName,
          counterpartyEmail: cp.email,
          grossYouOwe: this.fromCents(cp.youOweCents),
          grossTheyOwe: this.fromCents(cp.theyOweCents),
          settledPaid: this.fromCents(cp.settledPaidCents),
          settledReceived: this.fromCents(cp.settledReceivedCents),
          netAmount: this.fromCents(netCents),
          direction: 'you_owe',
          status: cp.settledPaidCents > 0 ? 'partially_paid' : 'pending',
          tripIds: Array.from(cp.tripIds),
        });
      } else {
        // They owe you
        const positiveTheyOwe = Math.abs(netCents);
        netReceivableCents += positiveTheyOwe;
        counterpartyResults.push({
          counterpartyId: cp.canonicalId,
          counterpartyName: cp.displayName,
          counterpartyEmail: cp.email,
          grossYouOwe: this.fromCents(cp.youOweCents),
          grossTheyOwe: this.fromCents(cp.theyOweCents),
          settledPaid: this.fromCents(cp.settledPaidCents),
          settledReceived: this.fromCents(cp.settledReceivedCents),
          netAmount: this.fromCents(positiveTheyOwe),
          direction: 'owes_you',
          status: cp.settledReceivedCents > 0 ? 'partially_paid' : 'pending',
          tripIds: Array.from(cp.tripIds),
        });
      }
    }

    const netBalanceCents = netReceivableCents - netPayableCents;
    const netBalance = this.fromCents(netBalanceCents);

    return {
      totalTripSpend: this.fromCents(totalTripSpendCents),
      totalPaid: this.fromCents(totalPaidCents),
      myShare: this.fromCents(myShareCents),
      grossOwedToYou: this.fromCents(grossOwedToYouCents),
      grossYouOwe: this.fromCents(grossYouOweCents),
      netReceivable: this.fromCents(netReceivableCents),
      netPayable: this.fromCents(netPayableCents),
      netBalance,
      status: netBalance > 0 ? 'in_credit' : netBalance < 0 ? 'in_debt' : 'settled',
      pendingSettlementCount: pendingCount,
      activeOutgoingPaymentsCount: activeOutgoingCount,
      baseCurrency: trips[0]?.baseCurrency || 'INR',
      counterparties: counterpartyResults,
    };
  }

  /**
   * Generates a transparent, real-data mathematical breakdown of the user's balance.
   */
  public static async getBalanceBreakdown(userId: string): Promise<BalanceBreakdown> {
    const balances = await this.getAuthoritativeBalances(userId);

    const totalSettledPaid = balances.counterparties.reduce((acc, c) => acc + c.settledPaid, 0);
    const totalSettledReceived = balances.counterparties.reduce((acc, c) => acc + c.settledReceived, 0);

    return {
      openingBalance: 0,
      totalPaidByUser: balances.totalPaid,
      userShareOfExpenses: balances.myShare,
      amountOthersOweUser: balances.grossOwedToYou,
      amountUserOwesOthers: balances.grossYouOwe,
      settledPaid: totalSettledPaid,
      settledReceived: totalSettledReceived,
      netBalance: balances.netBalance,
      formula: 'Net Balance = (Expenses Paid - Your Share) + Settled Outgoing - Settled Incoming',
      counterparties: balances.counterparties,
    };
  }
}
