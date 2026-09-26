import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import { Trip } from '../src/modules/trips/trip.model';
import { Expense } from '../src/modules/expense/expense.model';
import { Settlement } from '../src/modules/settlement/settlement.model';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('No MONGO_URI');
  await mongoose.connect(uri);

  const tripId = '6a58bed14a4e6dc9456c9528';
  console.log('=== TRIP INFO ===');
  const trip = await Trip.findById(tripId).lean();
  console.log('Trip:', JSON.stringify({
    title: trip?.title,
    members: trip?.members.map(m => ({
      userId: m.userId,
      name: m.displayName,
      totalPaidBase: m.totalPaidBase,
      totalOwesBase: m.totalOwesBase,
      net: (m.totalPaidBase || 0) - (m.totalOwesBase || 0)
    }))
  }, null, 2));

  console.log('\n=== SETTLEMENT ===');
  const settlement = await Settlement.findOne({ tripId: new mongoose.Types.ObjectId(tripId) }).lean();
  console.log('Settlement exists?', !!settlement);
  if (settlement) {
    console.log('Settlement calculatedAt:', settlement.calculatedAt);
    console.log('Settlement isStale:', settlement.isStale);
    console.log('Settlement isFullySettled:', settlement.isFullySettled);
    console.log('Transactions:', JSON.stringify(settlement.transactions.map((t: any) => ({
      id: t._id,
      from: t.fromName + ' (' + t.from + ')',
      to: t.toName + ' (' + t.to + ')',
      amountBase: t.amountBase,
      status: t.status,
      confirmedAt: t.confirmedAt
    })), null, 2));
    console.log('History:', JSON.stringify(settlement.history, null, 2));
  }

  console.log('\n=== EXPENSES ===');
  const expenses: any[] = await Expense.find({ tripId: new mongoose.Types.ObjectId(tripId) }).lean();
  console.log(`Found ${expenses.length} expenses:`);
  for (const exp of expenses) {
    console.log(`- [${exp._id}] "${exp.title}" base: ${exp.amountBase} paidBy: ${exp.paidBy} isSettled: ${exp.isSettled} isArchived: ${exp.isArchived}`);
    console.log(`  splits:`, (exp.splits || []).map((s: any) => ({
      userId: s.userId,
      amountBase: s.amountBase,
      isPaid: s.isPaid,
      paidAt: s.paidAt
    })));
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
