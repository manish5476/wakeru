import { Transaction, Budget, Bill, Goal, ITransaction } from './finance.model';

export class FinanceService {
  // ============================================================
  // TRANSACTIONS
  // ============================================================

  static async addTransaction(userId: string, data: Partial<ITransaction>) {
    const transaction = new Transaction({ ...data, userId });
    await transaction.save();

    // If it's an expense, update the budget for that month
    if (data.type === 'expense') {
      const month = new Date(data.date || Date.now()).toISOString().substring(0, 7); // YYYY-MM
      const amount = data.amount || 0;
      // We don't automatically deduct from total spent here unless we query the budget on read,
      // or we can just calculate totalSpent dynamically on the dashboard.
    }

    return transaction;
  }

  static async getTransactions(userId: string, filters: any = {}) {
    const query: any = { userId };
    
    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.month) {
      // filters.month is YYYY-MM
      const startDate = new Date(`${filters.month}-01T00:00:00Z`);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    return Transaction.find(query).sort({ date: -1, createdAt: -1 });
  }

  // ============================================================
  // BUDGET
  // ============================================================

  static async setBudget(userId: string, month: string, totalBudget: number, categoryBudgets: any[]) {
    return Budget.findOneAndUpdate(
      { userId, month },
      { totalBudget, categoryBudgets },
      { upsert: true, new: true }
    );
  }

  static async getBudget(userId: string, month: string) {
    return Budget.findOne({ userId, month });
  }

  // ============================================================
  // DASHBOARD
  // ============================================================

  static async getDashboard(userId: string, month: string) {
    // 1. Get transactions for the month
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const transactions = await Transaction.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 });

    let totalExpense = 0;
    let totalIncome = 0;
    const categorySpending: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.type === 'expense') {
        totalExpense += t.amount;
        categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
      } else if (t.type === 'income') {
        totalIncome += t.amount;
      }
    });

    // 2. Get Budget
    const budget = await Budget.findOne({ userId, month });
    
    // 3. Get Goals & Bills (simplified for now)
    const goals = await Goal.find({ userId, isCompleted: false });
    const bills = await Bill.find({ userId, isActive: true });

    return {
      monthlyOverview: {
        totalExpense,
        totalIncome,
        savings: totalIncome - totalExpense,
        budget: budget?.totalBudget || 0,
        budgetUsedPercentage: budget?.totalBudget ? (totalExpense / budget.totalBudget) * 100 : 0,
      },
      categorySpending: Object.keys(categorySpending).map(cat => ({
        category: cat,
        spent: categorySpending[cat],
        budget: budget?.categoryBudgets.find(b => b.category === cat)?.amount || 0
      })),
      recentTransactions: transactions.slice(0, 10),
      goals,
      bills
    };
  }
}
