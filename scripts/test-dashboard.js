const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Expense = mongoose.connection.collection('expenses');
  
  const userId = 'aeb013f3-fff5-4e60-b1aa-9bc54bf4d256';
  
  // 1. Dashboard query
  const youOweExpenses = await Expense.find({
      paidBy: { $ne: userId },
      splits: { $elemMatch: { userId: userId, isPaid: false } },
  }).toArray();
  
  console.log('youOweExpenses count:', youOweExpenses.length);
  
  // 2. See what expenses are generally out there for this user
  const youOweAgg = await Expense.find({
      paidBy: { $ne: userId }
  }).toArray();
  console.log('total not paid by user:', youOweAgg.length);
  console.log('Titles:', JSON.stringify(youOweAgg.map(e => e.title)));
  
  process.exit(0);
}
run().catch(console.error);
