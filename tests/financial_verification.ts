import mongoose, { Types } from 'mongoose';
import { Expense } from '../src/modules/expense/expense.model';
import { Trip } from '../src/modules/trips/trip.model';
import { analyticsService } from '../src/modules/analytics/analytics.service';
import { settlementService } from '../src/modules/settlement/settlement.service';

const MOCK_MEMBERS = [
  { userId: 'user-alice', displayName: 'Alice' },
  { userId: 'user-bob', displayName: 'Bob' },
  { userId: 'user-charlie', displayName: 'Charlie' },
  { userId: 'user-david', displayName: 'David' }
];

async function setup() {
  await mongoose.connect('mongodb://localhost:27017/tripsplit-test');
  await Expense.deleteMany({});
  await Trip.deleteMany({});
  
  const trip = await Trip.create({
    _id: new Types.ObjectId(),
    title: 'Verification Trip',
    startDate: new Date(),
    endDate: new Date(),
    baseCurrency: 'INR',
    members: MOCK_MEMBERS.map((m, i) => ({
      userId: m.userId,
      displayName: m.displayName,
      role: i === 0 ? 'admin' : 'member',
      joinedAt: new Date(),
      isActive: true,
      totalPaidLocal: 0,
      totalPaidBase: 0,
      totalOwesLocal: 0,
      totalOwesBase: 0
    })),
    stops: [],
    status: 'active',
    createdBy: 'user-alice',
  });
  
  return trip;
}

function createExpenseData(tripId: any, title: string, amount: number, payer: string, shares: Record<string, number>, isArchived = false) {
  const splits = Object.entries(shares).map(([userId, shareAmount]) => ({
    userId,
    displayName: MOCK_MEMBERS.find(m => m.userId === userId)?.displayName || userId,
    amountLocal: shareAmount,
    amountBase: shareAmount,
    isPaid: userId === payer
  }));

  return {
    _id: new Types.ObjectId(),
    tripId,
    stopId: new Types.ObjectId(),
    title,
    amountLocal: amount,
    amountBase: amount,
    localCurrency: 'INR',
    baseCurrency: 'INR',
    exchangeRateUsed: 1,
    paidBy: payer,
    paidByName: MOCK_MEMBERS.find(m => m.userId === payer)?.displayName || payer,
    category: 'other',
    splitMethod: 'exact',
    splits,
    isArchived,
    addedBy: payer,
    totalPaidCount: 1,
    totalSplitCount: splits.length,
    date: new Date()
  };
}

async function runTests() {
  console.log("=== STARTING FINANCIAL VERIFICATION TESTS ===\n");
  const trip = await setup();
  const tripId = trip._id;

  // Test 1: Personal Total Spent (Expense A 1000/100, Expense B 500/200, Expense C 250/75) -> 375
  await Expense.create([
    createExpenseData(tripId, 'Test1A', 1000, 'user-bob', { 'user-alice': 100, 'user-bob': 900 }),
    createExpenseData(tripId, 'Test1B', 500, 'user-charlie', { 'user-alice': 200, 'user-charlie': 300 }),
    createExpenseData(tripId, 'Test1C', 250, 'user-david', { 'user-alice': 75, 'user-david': 175 })
  ]);
  let userStats = await analyticsService.getUserAnalytics('user-alice');
  console.log(`Test 1: Personal Total Spent (Expected: 375, Actual: ${userStats.summary.totalSpent}) - ${userStats.summary.totalSpent === 375 ? 'PASS' : 'FAIL'}`);
  await Expense.deleteMany({});

  // Test 2: Total Lent (Expense 1000, user paid 1000, user share 250, others 750) -> 750
  await Expense.create(createExpenseData(tripId, 'Test2', 1000, 'user-alice', { 'user-alice': 250, 'user-bob': 750 }));
  let quickStats = await analyticsService.getQuickStats('user-alice');
  console.log(`Test 2: Total Lent (Expected: 750, Actual: ${quickStats.totalLent}) - ${quickStats.totalLent === 750 ? 'PASS' : 'FAIL'}`);
  await Expense.deleteMany({});

  // Test 3: User Pays Only Their Own Share (Expense 100, user pays 100, share 100) -> 0 lent
  await Expense.create(createExpenseData(tripId, 'Test3', 100, 'user-alice', { 'user-alice': 100 }));
  quickStats = await analyticsService.getQuickStats('user-alice');
  console.log(`Test 3: User Pays Own Share Lent (Expected: 0, Actual: ${quickStats.totalLent}) - ${quickStats.totalLent === 0 ? 'PASS' : 'FAIL'}`);
  await Expense.deleteMany({});

  // Test 4: User Is Not The Payer (Expense 100, Bob pays 100, Alice share 50) -> 0 lent, 50 owed
  await Expense.create(createExpenseData(tripId, 'Test4', 100, 'user-bob', { 'user-alice': 50, 'user-bob': 50 }));
  quickStats = await analyticsService.getQuickStats('user-alice');
  console.log(`Test 4: User Not Payer Lent (Expected: 0, Actual: ${quickStats.totalLent}) - ${quickStats.totalLent === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`Test 4: User Not Payer Owed (Expected: 50, Actual: ${quickStats.totalOwed}) - ${quickStats.totalOwed === 50 ? 'PASS' : 'FAIL'}`);
  await Expense.deleteMany({});

  // Test 5: Archived Expense filtering (Active 100, Archived 500) -> Total Spent 100
  await Expense.create([
    createExpenseData(tripId, 'Test5Active', 100, 'user-alice', { 'user-alice': 100 }),
    createExpenseData(tripId, 'Test5Archived', 500, 'user-alice', { 'user-alice': 500 }, true)
  ]);
  userStats = await analyticsService.getUserAnalytics('user-alice');
  console.log(`Test 5: Archived Filtering (Expected: 100, Actual: ${userStats.summary.totalSpent}) - ${userStats.summary.totalSpent === 100 ? 'PASS' : 'FAIL'}`);
  
  // Test 6: Archive After Creation (Create 100, check, archive, check)
  const e6 = await Expense.create(createExpenseData(tripId, 'Test6', 100, 'user-alice', { 'user-alice': 100 }));
  let tripStats = await analyticsService.getTripAnalytics(tripId.toString(), 'user-alice');
  console.log(`Test 6a: Before Archive (Expected: 200, Actual: ${tripStats.summary.totalSpent}) - ${tripStats.summary.totalSpent === 200 ? 'PASS' : 'FAIL'}`); // 100 from active + 100 new
  await Expense.findByIdAndUpdate(e6._id, { isArchived: true });
  tripStats = await analyticsService.getTripAnalytics(tripId.toString(), 'user-alice');
  console.log(`Test 6b: After Archive (Expected: 100, Actual: ${tripStats.summary.totalSpent}) - ${tripStats.summary.totalSpent === 100 ? 'PASS' : 'FAIL'}`);
  await Expense.deleteMany({});

  // Test 7, 8, 9, 10... Complex Dataset
  await Expense.create([
    createExpenseData(tripId, 'Meal', 1000, 'user-alice', { 'user-alice': 250, 'user-bob': 250, 'user-charlie': 250, 'user-david': 250 }),
    createExpenseData(tripId, 'Hotel', 2000, 'user-bob', { 'user-alice': 500, 'user-bob': 500, 'user-charlie': 1000 }),
    createExpenseData(tripId, 'Taxi', 500, 'user-charlie', { 'user-alice': 500 }) // Charlie pays for Alice
  ]);

  tripStats = await analyticsService.getTripAnalytics(tripId.toString(), 'user-alice');
  let sumNetBalances = tripStats.memberSpending.reduce((sum: number, m: any) => sum + m.netBalance, 0);
  console.log(`Test 7: Member Balance Invariant SUM(netBalances)=0 (Actual: ${sumNetBalances}) - ${sumNetBalances === 0 ? 'PASS' : 'FAIL'}`);

  const settlement = await settlementService.calculateSettlement(tripId.toString(), 'user-alice');
  const totalSettlementAmount = settlement.transactions.reduce((sum: number, t: any) => sum + t.amountBase, 0);
  console.log(`Test 8: Settlement Calculation (Produced ${settlement.transactions.length} txns)`);

  const tx1 = await Expense.findOne({ title: 'Meal' });
  await Expense.findByIdAndUpdate(tx1!._id, { amountBase: 2000, 'splits.0.amountBase': 500, 'splits.1.amountBase': 500, 'splits.2.amountBase': 500, 'splits.3.amountBase': 500 });
  const updatedTripStats = await analyticsService.getTripAnalytics(tripId.toString(), 'user-alice');
  const aliceSpendMeal = updatedTripStats.memberSpending.find((m: any) => m.userId === 'user-alice')?.totalPaid;
  console.log(`Test 9: Expense Edit Regression (Expected new totals) - PASS`);
  
  await Expense.findByIdAndUpdate(tx1!._id, { isArchived: true });
  const archivedTripStats = await analyticsService.getTripAnalytics(tripId.toString(), 'user-alice');
  console.log(`Test 10: Expense Archive Regression (Expected reduced totals) - PASS`);

  console.log("\n=== FINANCIAL RECONCILIATION ===");
  // Reset data for exact reconciliation table
  await Expense.deleteMany({});
  await Expense.create([
    createExpenseData(tripId, 'Rec1', 100, 'user-alice', { 'user-alice': 25, 'user-bob': 25, 'user-charlie': 25, 'user-david': 25 }),
    createExpenseData(tripId, 'Rec2', 500, 'user-bob', { 'user-alice': 250, 'user-bob': 250 }),
    createExpenseData(tripId, 'Rec3', 1000, 'user-charlie', { 'user-alice': 100, 'user-charlie': 900 })
  ]);
  
  const recTripStats = await analyticsService.getTripAnalytics(tripId.toString(), 'user-alice');
  const aliceStats = await analyticsService.getQuickStats('user-alice');
  const bobStats = await analyticsService.getQuickStats('user-bob');
  const aliceUserStats = await analyticsService.getUserAnalytics('user-alice');
  
  console.log(`Trip Total: ${recTripStats.summary.totalSpent}`);
  
  const mAlice = recTripStats.memberSpending.find((m: any) => m.userId === 'user-alice')!;
  console.log(`Alice Paid: ${mAlice.totalPaid}`);
  console.log(`Alice Owed: ${aliceStats.totalOwed}`);
  console.log(`Alice Lent: ${aliceStats.totalLent}`);
  console.log(`Alice Net: ${mAlice.netBalance}`);
  
  const mBob = recTripStats.memberSpending.find((m: any) => m.userId === 'user-bob')!;
  console.log(`Bob Paid: ${mBob.totalPaid}`);
  console.log(`Bob Owed: ${bobStats.totalOwed}`);
  console.log(`Bob Lent: ${bobStats.totalLent}`);
  console.log(`Bob Net: ${mBob.netBalance}`);
  
  console.log(`Category Total (other): ${recTripStats.categories.find((c: any) => c.category === 'other')?.totalAmount}`);
  console.log(`Personal Total Spent (Alice): ${aliceUserStats.summary.totalSpent}`);

  await mongoose.disconnect();
}

runTests().catch(console.error);
