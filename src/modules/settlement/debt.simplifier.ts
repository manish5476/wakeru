import { Types } from 'mongoose';
import Decimal from 'decimal.js';

export interface Debt {
  from: string;
  to: string;
  amount: Types.Decimal128;
  groupId: string;
  expenseId?: string;
}

interface SimplifiedTransaction {
  from: string;
  to: string;
  amount: Types.Decimal128;
  note: string;
  relatedExpenses?: string[];
}

export class DebtSimplifier {
  /**
   * Minimize number of transactions using graph algorithm
   * Time Complexity: O(n log n) where n is number of participants
   */
  simplifyDebts(debts: Debt[]): SimplifiedTransaction[] {
    if (debts.length === 0) return [];

    // Step 1: Calculate net balance for each user
    const netBalances = new Map<string, Decimal>();

    debts.forEach(debt => {
      const from = debt.from;
      const to = debt.to;
      const amount = new Decimal(debt.amount.toString());

      // User who owes money (negative balance)
      const fromBalance = netBalances.get(from) || new Decimal(0);
      netBalances.set(from, fromBalance.minus(amount));

      // User who is owed money (positive balance)
      const toBalance = netBalances.get(to) || new Decimal(0);
      netBalances.set(to, toBalance.plus(amount));
    });

    // Step 2: Separate creditors and debtors
    const creditors: Array<{ userId: string; amount: Decimal }> = [];
    const debtors: Array<{ userId: string; amount: Decimal }> = [];

    for (const [userId, balance] of netBalances) {
      // Ignore very small balances (less than 0.01)
      if (balance.abs().lessThan(0.01)) continue;

      if (balance.isPositive()) {
        creditors.push({ userId, amount: balance });
      } else {
        debtors.push({ userId, amount: balance.abs() });
      }
    }

    // Step 3: Sort by amount (greedy optimization)
    creditors.sort((a, b) => b.amount.minus(a.amount).toNumber());
    debtors.sort((a, b) => b.amount.minus(a.amount).toNumber());

    // Step 4: Greedy transaction minimization
    const simplifiedTransactions: SimplifiedTransaction[] = [];
    let creditorIdx = 0;
    let debtorIdx = 0;

    while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
      const creditor = creditors[creditorIdx];
      const debtor = debtors[debtorIdx];

      // Find the minimum amount to transfer
      const transferAmount = Decimal.min(creditor.amount, debtor.amount);

      if (transferAmount.greaterThan(0.01)) {
        simplifiedTransactions.push({
          from: debtor.userId,
          to: creditor.userId,
          amount: Types.Decimal128.fromString(transferAmount.toFixed(2)),
          note: `Settlement payment`,
          relatedExpenses: debts
            .filter(d => (d.from === debtor.userId && d.to === creditor.userId) ||
                        (d.from === creditor.userId && d.to === debtor.userId))
            .map(d => d.expenseId!)
            .filter(Boolean)
        });
      }

      // Update remaining balances
      creditor.amount = creditor.amount.minus(transferAmount);
      debtor.amount = debtor.amount.minus(transferAmount);

      // Move to next user if balance is settled
      if (creditor.amount.lessThan(0.01)) creditorIdx++;
      if (debtor.amount.lessThan(0.01)) debtorIdx++;
    }

    return this.applyCircularOptimization(simplifiedTransactions);
  }

  /**
   * Detect and remove circular debts
   * Example: A->B $50, B->C $50, C->A $50 can all be cancelled
   */
  private applyCircularOptimization(
    transactions: SimplifiedTransaction[]
  ): SimplifiedTransaction[] {
    if (transactions.length < 3) return transactions;

    const optimized: SimplifiedTransaction[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
      const tx1 = transactions[i];
      const key1 = `${tx1.from}-${tx1.to}`;
      
      if (processed.has(key1)) continue;

      let foundOptimization = false;

      // Look for 2-step circular debts
      for (let j = i + 1; j < transactions.length; j++) {
        const tx2 = transactions[j];
        const key2 = `${tx2.from}-${tx2.to}`;
        
        if (processed.has(key2)) continue;

        // Check for reverse transaction (A->B and B->A)
        if (tx1.from === tx2.to && tx1.to === tx2.from) {
          const amount1 = new Decimal(tx1.amount.toString());
          const amount2 = new Decimal(tx2.amount.toString());

          if (amount1.equals(amount2)) {
            // Exact match - cancel both
            processed.add(key1);
            processed.add(key2);
            foundOptimization = true;
            break;
          } else if (amount1.greaterThan(amount2)) {
            // Partial match - adjust amount
            const diff = amount1.minus(amount2);
            optimized.push({
              ...tx1,
              amount: Types.Decimal128.fromString(diff.toFixed(2))
            });
            processed.add(key1);
            processed.add(key2);
            foundOptimization = true;
            break;
          } else {
            // Partial match - adjust amount
            const diff = amount2.minus(amount1);
            optimized.push({
              ...tx2,
              amount: Types.Decimal128.fromString(diff.toFixed(2))
            });
            processed.add(key1);
            processed.add(key2);
            foundOptimization = true;
            break;
          }
        }
      }

      // Look for 3-step circular debts
      if (!foundOptimization) {
        for (let j = i + 1; j < transactions.length; j++) {
          const tx2 = transactions[j];
          if (processed.has(`${tx2.from}-${tx2.to}`)) continue;

          for (let k = j + 1; k < transactions.length; k++) {
            const tx3 = transactions[k];
            if (processed.has(`${tx3.from}-${tx3.to}`)) continue;

            // Check for circle: A->B, B->C, C->A
            if (tx1.to === tx2.from && tx2.to === tx3.from && tx3.to === tx1.from) {
              const amount1 = new Decimal(tx1.amount.toString());
              const amount2 = new Decimal(tx2.amount.toString());
              const amount3 = new Decimal(tx3.amount.toString());
              
              // If all equal, cancel all three
              if (amount1.equals(amount2) && amount2.equals(amount3)) {
                processed.add(`${tx1.from}-${tx1.to}`);
                processed.add(`${tx2.from}-${tx2.to}`);
                processed.add(`${tx3.from}-${tx3.to}`);
                foundOptimization = true;
                break;
              }
            }
          }
          if (foundOptimization) break;
        }
      }

      if (!foundOptimization) {
        optimized.push(tx1);
        processed.add(key1);
      }
    }

    return optimized;
  }

  /**
   * Get debt summary for a user
   */
  getDebtSummary(userId: string, debts: Debt[]): {
    owes: Array<{ to: string; amount: number; currency: string }>;
    isOwed: Array<{ from: string; amount: number; currency: string }>;
    netBalance: number;
  } {
    const owes: Map<string, number> = new Map();
    const isOwed: Map<string, number> = new Map();

    debts.forEach(debt => {
      if (debt.from === userId) {
        const current = owes.get(debt.to) || 0;
        owes.set(debt.to, current + parseFloat(debt.amount.toString()));
      }
      
      if (debt.to === userId) {
        const current = isOwed.get(debt.from) || 0;
        isOwed.set(debt.from, current + parseFloat(debt.amount.toString()));
      }
    });

    const owesArray = Array.from(owes.entries()).map(([to, amount]) => ({
      to,
      amount,
      currency: 'INR' // Default, should come from debt
    }));

    const isOwedArray = Array.from(isOwed.entries()).map(([from, amount]) => ({
      from,
      amount,
      currency: 'INR'
    }));

    const netBalance = isOwedArray.reduce((sum, item) => sum + item.amount, 0) -
                      owesArray.reduce((sum, item) => sum + item.amount, 0);

    return {
      owes: owesArray,
      isOwed: isOwedArray,
      netBalance: Math.round(netBalance * 100) / 100
    };
  }
}

export const debtSimplifier = new DebtSimplifier();