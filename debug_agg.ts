import mongoose from 'mongoose';
import { Expense } from './src/modules/expense/expense.model';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/tripsplit-test');
  
  const userId = 'alice-uid';
  
  console.log("Checking expenses for ALICE as payer...");
  const expenses = await Expense.find({ paidBy: userId });
  console.log(JSON.stringify(expenses, null, 2));

  const result = await Expense.aggregate([
    { $match: { paidBy: userId, 'splits.userId': { $ne: userId }, 'splits.isPaid': false } },
    { $unwind: '$splits' },
    { $match: { 'splits.userId': { $ne: userId }, 'splits.isPaid': false } },
    { $group: { _id: null, total: { $sum: '$splits.amountBase' } } }
  ]);
  
  console.log("Aggregate Result:", result);
  
  await mongoose.disconnect();
}

run().catch(console.error);
