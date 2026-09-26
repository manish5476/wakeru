import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import { Expense } from '../src/modules/expense/expense.model';
import { Trip } from '../src/modules/trips/trip.model';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('No MONGO_URI');
  await mongoose.connect(uri);

  const tripId = '6a58bed14a4e6dc9456c9528';
  const expenses: any[] = await Expense.find({ tripId: new mongoose.Types.ObjectId(tripId) }).lean();
  const trip = await Trip.findById(tripId).lean();

  const members = trip?.members || [];
  const memberNames: Record<string, string> = {};
  members.forEach(m => {
    memberNames[m.userId] = m.displayName;
  });

  // Calculate pairwise debts for ALL expenses (unfiltered) vs UNPAID splits
  console.log('--- ALL EXPENSES (Total spending & split shares) ---');
  const totalPaid: Record<string, number> = {};
  const totalOwed: Record<string, number> = {};
  members.forEach(m => {
    totalPaid[m.userId] = 0;
    totalOwed[m.userId] = 0;
  });

  // Pairwise: net[payer][debtor]
  const pairwiseRaw: Record<string, Record<string, number>> = {};
  const pairwiseUnpaid: Record<string, Record<string, number>> = {};
  const pairwisePaid: Record<string, Record<string, number>> = {};

  members.forEach(m1 => {
    pairwiseRaw[m1.userId] = {};
    pairwiseUnpaid[m1.userId] = {};
    pairwisePaid[m1.userId] = {};
    members.forEach(m2 => {
      pairwiseRaw[m1.userId][m2.userId] = 0;
      pairwiseUnpaid[m1.userId][m2.userId] = 0;
      pairwisePaid[m1.userId][m2.userId] = 0;
    });
  });

  for (const exp of expenses) {
    if (exp.isArchived) continue;
    const payer = exp.paidBy;
    if (totalPaid[payer] !== undefined) {
      totalPaid[payer] += exp.amountBase;
    }
    for (const split of exp.splits || []) {
      const debtor = split.userId;
      if (totalOwed[debtor] !== undefined) {
        totalOwed[debtor] += split.amountBase;
      }
      if (payer !== debtor) {
        if (pairwiseRaw[payer]?.[debtor] !== undefined) {
          pairwiseRaw[payer][debtor] += split.amountBase;
        }
        if (split.isPaid) {
          pairwisePaid[payer][debtor] += split.amountBase;
        } else {
          pairwiseUnpaid[payer][debtor] += split.amountBase;
        }
      }
    }
  }

  console.log('MEMBER TOTALS FROM EXPENSES:');
  members.forEach(m => {
    const p = totalPaid[m.userId] || 0;
    const o = totalOwed[m.userId] || 0;
    console.log(`- ${m.displayName}: Paid = ${p.toFixed(2)}, Owes = ${o.toFixed(2)}, Net = ${(p - o).toFixed(2)} (Trip Model has: Paid=${m.totalPaidBase}, Owes=${m.totalOwesBase})`);
  });

  console.log('\n--- PAIRWISE UNPAID SPLITS (Who owes whom in unpaid expenses) ---');
  members.forEach(m1 => {
    members.forEach(m2 => {
      if (m1.userId < m2.userId) {
        const u1 = pairwiseUnpaid[m1.userId][m2.userId]; // m2 owes m1
        const u2 = pairwiseUnpaid[m2.userId][m1.userId]; // m1 owes m2
        const netOwed = u1 - u2; // positive means m2 owes m1
        if (Math.abs(netOwed) > 0.01 || u1 > 0 || u2 > 0) {
          console.log(`Between ${m1.displayName} and ${m2.displayName}:`);
          console.log(`  ${m2.displayName} owes ${m1.displayName} unpaid: ${u1.toFixed(2)}`);
          console.log(`  ${m1.displayName} owes ${m2.displayName} unpaid: ${u2.toFixed(2)}`);
          console.log(`  Net: ${netOwed > 0 ? `${m2.displayName} owes ${m1.displayName} ${netOwed.toFixed(2)}` : `${m1.displayName} owes ${m2.displayName} ${(-netOwed).toFixed(2)}`}`);
        }
      }
    });
  });

  console.log('\n--- PAIRWISE PAID / SETTLED SPLITS ---');
  members.forEach(m1 => {
    members.forEach(m2 => {
      if (m1.userId < m2.userId) {
        const p1 = pairwisePaid[m1.userId][m2.userId];
        const p2 = pairwisePaid[m2.userId][m1.userId];
        if (p1 > 0 || p2 > 0) {
          console.log(`Between ${m1.displayName} and ${m2.displayName}:`);
          console.log(`  ${m2.displayName} already paid ${m1.displayName}: ${p1.toFixed(2)}`);
          console.log(`  ${m1.displayName} already paid ${m2.displayName}: ${p2.toFixed(2)}`);
        }
      }
    });
  });

  await mongoose.disconnect();
}

main().catch(console.error);
