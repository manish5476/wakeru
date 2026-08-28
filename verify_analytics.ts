import mongoose from 'mongoose';
import { Expense } from './src/modules/expense/expense.model';
import { Trip } from './src/modules/trips/trip.model';
import { Stop } from './src/modules/trips/stop.model';
import { analyticsService } from './src/modules/analytics/analytics.service';
import { settlementService } from './src/modules/settlement/settlement.service';
import { computeSplits } from './src/modules/expense/expense.service';

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const CHARLIE = 'charlie-uid';
const DAVID = 'david-uid';

const MOCK_MEMBERS = [
  { userId: ALICE, displayName: 'Alice' },
  { userId: BOB, displayName: 'Bob' },
  { userId: CHARLIE, displayName: 'Charlie' },
  { userId: DAVID, displayName: 'David' }
];

async function runTest() {
  await mongoose.connect('mongodb://localhost:27017/tripsplit-test');
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }

  const trip = await Trip.create({
    title: 'Test Trip',
    description: 'A test trip',
    coverImage: 'none',
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000 * 5),
    status: 'active',
    baseCurrency: 'INR',
    allowAnyPayer: true,
    members: MOCK_MEMBERS.map(m => ({
      userId: m.userId,
      displayName: m.displayName,
      role: 'admin',
      joinedAt: new Date(),
      totalPaidBase: 0,
      totalOwesBase: 0,
      totalPaidLocal: 0,
      totalOwesLocal: 0,
      isActive: true
    })),
    stops: [],
    totalBudget: 10000,
    createdBy: ALICE,
    createdById: ALICE
  });

  const stop = await Stop.create({
    tripId: trip._id,
    name: 'Test Stop',
    currency: 'INR',
    currentExchangeRate: 1,
    budget: 10000,
    totalSpentLocal: 0,
    totalSpentBase: 0,
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000 * 5),
    createdBy: ALICE
  });

  // Expense 1: ₹100, Alice pays, Equal split between 4
  const e1Splits = computeSplits({ method: 'equal', memberIds: [ALICE, BOB, CHARLIE, DAVID] }, 100, 100, 1, ALICE, MOCK_MEMBERS);
  await Expense.create({
    tripId: trip._id,
    stopId: stop._id,
    title: 'Expense 1',
    category: 'food',
    date: new Date(),
    amountLocal: 100,
    amountBase: 100,
    localCurrency: 'INR',
    baseCurrency: 'INR',
    exchangeRateUsed: 1,
    paidBy: ALICE,
    paidByName: 'Alice',
    splitMethod: 'equal',
    splits: e1Splits,
    addedBy: ALICE,
    isSettled: false,
    comments: [],
    attachments: [],
    expenseHistory: []
  });

  // Expense 2: ₹500, Bob pays, Alice + Bob (equal)
  const e2Splits = computeSplits({ method: 'equal', memberIds: [ALICE, BOB] }, 500, 500, 1, BOB, MOCK_MEMBERS);
  await Expense.create({
    tripId: trip._id,
    stopId: stop._id,
    title: 'Expense 2',
    category: 'transport',
    date: new Date(),
    amountLocal: 500,
    amountBase: 500,
    localCurrency: 'INR',
    baseCurrency: 'INR',
    exchangeRateUsed: 1,
    paidBy: BOB,
    paidByName: 'Bob',
    splitMethod: 'equal',
    splits: e2Splits,
    addedBy: ALICE,
    isSettled: false,
    comments: [],
    attachments: [],
    expenseHistory: []
  });

  // Expense 3: ₹1000, Charlie pays, Custom exact: Alice 100, Bob 200, Charlie 500, David 200
  const e3Splits = computeSplits({ 
    method: 'exact', 
    members: [
      { userId: ALICE, displayName: 'Alice', amountLocal: 100 },
      { userId: BOB, displayName: 'Bob', amountLocal: 200 },
      { userId: CHARLIE, displayName: 'Charlie', amountLocal: 500 },
      { userId: DAVID, displayName: 'David', amountLocal: 200 }
    ] 
  }, 1000, 1000, 1, CHARLIE, MOCK_MEMBERS);
  await Expense.create({
    tripId: trip._id,
    stopId: stop._id,
    title: 'Expense 3',
    category: 'stay',
    date: new Date(),
    amountLocal: 1000,
    amountBase: 1000,
    localCurrency: 'INR',
    baseCurrency: 'INR',
    exchangeRateUsed: 1,
    paidBy: CHARLIE,
    paidByName: 'Charlie',
    splitMethod: 'exact',
    splits: e3Splits,
    addedBy: ALICE,
    isSettled: false,
    comments: [],
    attachments: [],
    expenseHistory: []
  });

  let totalPaid: Record<string, number> = { [ALICE]: 100, [BOB]: 500, [CHARLIE]: 1000, [DAVID]: 0 };
  let totalOwed: Record<string, number> = {
    [ALICE]: 25 + 250 + 100, // 375
    [BOB]: 25 + 250 + 200, // 475
    [CHARLIE]: 25 + 0 + 500, // 525
    [DAVID]: 25 + 0 + 200 // 225
  };

  for (let m of trip.members) {
    m.totalPaidBase = totalPaid[m.userId] || 0;
    m.totalOwesBase = totalOwed[m.userId] || 0;
  }
  await trip.save();

  const tripAnalytics = await analyticsService.getTripAnalytics(trip._id.toString(), ALICE);
  
  const aliceDash = await analyticsService.getQuickStats(ALICE);
  const aliceUser = await analyticsService.getUserAnalytics(ALICE);

  const bobDash = await analyticsService.getQuickStats(BOB);
  const bobUser = await analyticsService.getUserAnalytics(BOB);

  console.log("=== TRIP TOTALS ===");
  console.log("Trip Total Spent:", tripAnalytics.summary.totalSpent);
  console.log("Expected Trip Total: 1600");
  
  console.log("\\n=== ALICE DASHBOARD (QuickStats) ===");
  console.log("Expected Owed: 350 (250 to Bob + 100 to Charlie)");
  console.log("Actual Owed:", aliceDash.totalOwed);
  console.log("Expected Lent: 75 (25 to Bob, 25 to Charlie, 25 to David)");
  console.log("Actual Lent:", aliceDash.totalLent);
  console.log("Expected Net: -275");
  console.log("Actual Net:", aliceDash.netBalance);
  
  console.log("\\n=== USER DASHBOARD (UserAnalytics) ===");
  console.log("Expected Alice Total Spent (her shares): 375");
  console.log("Actual Alice Total Spent:", aliceUser.summary.totalSpent);
  
  console.log("Expected Bob Total Spent (his shares): 475");
  console.log("Actual Bob Total Spent:", bobUser.summary.totalSpent);
  
  console.log("\\n=== SETTLEMENT (Debt Simplifier) ===");
  await settlementService.calculateSettlement(trip._id.toString(), ALICE);
  const settlement = await mongoose.model('Settlement').findOne({ tripId: trip._id });
  console.log("Settlement Transactions:");
  if (settlement && settlement.transactions) {
      settlement.transactions.forEach((tx: any) => {
        console.log(`  ${tx.fromUserId} -> ${tx.toUserId} = ${tx.amountBase}`);
      });
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
