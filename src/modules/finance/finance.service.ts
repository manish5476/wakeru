// finance.service.ts
import { Transaction, Budget, Bill, Goal, ITransaction, IGoal, IBill, IBudget } from './finance.model';
import mongoose from 'mongoose';
import { AppError } from '../../shared/errors/AppError';

interface DashboardFilters {
  month?: string;
  type?: string;
  category?: string;
  limit?: number;
}

interface TransactionFilters {
  type?: string;
  category?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
}

export class FinanceService {
  // ============================================================
  // TRANSACTION CRUD
  // ============================================================

  static async createTransaction(userId: string, data: Partial<ITransaction>) {
    const transaction = new Transaction({ 
      ...data, 
      userId,
      date: data.date || new Date(),
    });
    await transaction.save();

    // Update category budget spent
    if (data.type === 'expense' && data.category) {
      const month = new Date(data.date || Date.now()).toISOString().substring(0, 7);
      await this.updateCategoryBudgetSpent(userId, month, data.category, data.amount || 0);
    }

    return transaction;
  }

  static async getTransactions(userId: string, filters: TransactionFilters = {}) {
    const query: any = { userId, isDeleted: false };
    
    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    
    if (filters.month) {
      const startDate = new Date(`${filters.month}-01T00:00:00Z`);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    } else if (filters.startDate && filters.endDate) {
      query.date = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    }

    const limit = Math.min(filters.limit || 50, 100);
    const page = Math.max(filters.page || 1, 1);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('tripId', 'title coverImage'),
      Transaction.countDocuments(query)
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  static async getTransactionById(userId: string, transactionId: string) {
    const transaction = await Transaction.findOne({ 
      _id: transactionId, 
      userId,
      isDeleted: false 
    }).populate('tripId', 'title coverImage');

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    return transaction;
  }

  static async updateTransaction(userId: string, transactionId: string, data: Partial<ITransaction>) {
    const transaction = await Transaction.findOne({ 
      _id: transactionId, 
      userId,
      isDeleted: false 
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    // If amount or category changed, update budget
    const oldAmount = transaction.amount;
    const oldCategory = transaction.category;
    const oldType = transaction.type;

    Object.assign(transaction, data);
    await transaction.save();

    // Update category budget if expense changed
    if (oldType === 'expense') {
      const month = new Date(transaction.date).toISOString().substring(0, 7);
      
      // Reverse old
      await this.updateCategoryBudgetSpent(userId, month, oldCategory, -oldAmount);
      
      // Apply new
      if (data.type === 'expense') {
        const newMonth = new Date(data.date || transaction.date).toISOString().substring(0, 7);
        const newAmount = data.amount || transaction.amount;
        const newCategory = data.category || transaction.category;
        await this.updateCategoryBudgetSpent(userId, newMonth, newCategory, newAmount);
      }
    }

    return transaction;
  }

  static async deleteTransaction(userId: string, transactionId: string, permanent: boolean = false) {
    const transaction = await Transaction.findOne({ 
      _id: transactionId, 
      userId 
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    if (permanent) {
      // If expense, reverse budget
      if (transaction.type === 'expense') {
        const month = new Date(transaction.date).toISOString().substring(0, 7);
        await this.updateCategoryBudgetSpent(userId, month, transaction.category, -transaction.amount);
      }
      await transaction.deleteOne();
    } else {
      // Soft delete
      transaction.isDeleted = true;
      transaction.deletedAt = new Date();
      await transaction.save();
    }

    return { success: true, message: 'Transaction deleted successfully' };
  }

  static async restoreTransaction(userId: string, transactionId: string) {
    const transaction = await Transaction.findOne({ 
      _id: transactionId, 
      userId,
      isDeleted: true 
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    transaction.isDeleted = false;
    transaction.deletedAt = undefined;
    await transaction.save();

    // Restore budget if expense
    if (transaction.type === 'expense') {
      const month = new Date(transaction.date).toISOString().substring(0, 7);
      await this.updateCategoryBudgetSpent(userId, month, transaction.category, transaction.amount);
    }

    return transaction;
  }

  // ============================================================
  // BUDGET CRUD
  // ============================================================

  static async setBudget(
    userId: string, 
    month: string, 
    totalBudget: number, 
    categoryBudgets: { category: string; amount: number }[] = []
  ) {
    // Calculate spent for each category from transactions
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const transactions = await Transaction.find({
      userId,
      type: 'expense',
      date: { $gte: startDate, $lte: endDate },
      isDeleted: false
    });

    const categorySpent: Record<string, number> = {};
    transactions.forEach(t => {
      categorySpent[t.category] = (categorySpent[t.category] || 0) + t.amount;
    });

    const categoryBudgetsWithSpent = categoryBudgets.map(cb => ({
      ...cb,
      spent: categorySpent[cb.category] || 0
    }));

    const budget = await Budget.findOneAndUpdate(
      { userId, month },
      { 
        totalBudget, 
        categoryBudgets: categoryBudgetsWithSpent 
      },
      { upsert: true, new: true }
    );

    return budget;
  }

  static async getBudget(userId: string, month: string) {
    let budget = await Budget.findOne({ userId, month });
    
    // If no budget found, create default
    if (!budget) {
      const totalExpense = await this.getTotalExpenseForMonth(userId, month);
      budget = await Budget.create({
        userId,
        month,
        totalBudget: 0,
        categoryBudgets: []
      });
    }

    return budget;
  }

  static async updateCategoryBudgetSpent(
    userId: string, 
    month: string, 
    category: string, 
    amountDelta: number
  ) {
    if (amountDelta === 0) return;

    const budget = await Budget.findOne({ userId, month });
    if (!budget) return;

    // Update category budget spent
    const categoryBudget = budget.categoryBudgets.find(cb => cb.category === category);
    if (categoryBudget) {
      categoryBudget.spent = Math.max(0, (categoryBudget.spent || 0) + amountDelta);
    }

    await budget.save();
  }

  static async getTotalExpenseForMonth(userId: string, month: string) {
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const result = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: 'expense',
          date: { $gte: startDate, $lte: endDate },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    return result[0]?.total || 0;
  }

  // ============================================================
  // BILL CRUD
  // ============================================================

  static async createBill(userId: string, data: Partial<IBill>) {
    const bill = new Bill({ ...data, userId });
    await bill.save();
    return bill;
  }

  static async getBills(userId: string, filters: { isActive?: boolean; category?: string } = {}) {
    const query: any = { userId };
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.category) query.category = filters.category;

    return Bill.find(query).sort({ dueDate: 1 });
  }

  static async getBillById(userId: string, billId: string) {
    const bill = await Bill.findOne({ _id: billId, userId });
    if (!bill) {
      throw new AppError('Bill not found', 404);
    }
    return bill;
  }

  static async updateBill(userId: string, billId: string, data: Partial<IBill>) {
    const bill = await Bill.findOne({ _id: billId, userId });
    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    Object.assign(bill, data);
    await bill.save();
    return bill;
  }

  static async deleteBill(userId: string, billId: string) {
    const bill = await Bill.findOne({ _id: billId, userId });
    if (!bill) {
      throw new AppError('Bill not found', 404);
    }

    await bill.deleteOne();
    return { success: true, message: 'Bill deleted successfully' };
  }

  // ============================================================
  // GOAL CRUD
  // ============================================================

  static async createGoal(userId: string, data: Partial<IGoal>) {
    const goal = new Goal({ ...data, userId });
    await goal.save();
    return goal;
  }

  static async getGoals(userId: string, filters: { isCompleted?: boolean } = {}) {
    const query: any = { userId };
    if (filters.isCompleted !== undefined) query.isCompleted = filters.isCompleted;

    return Goal.find(query).sort({ targetDate: 1 });
  }

  static async getGoalById(userId: string, goalId: string) {
    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) {
      throw new AppError('Goal not found', 404);
    }
    return goal;
  }

  static async updateGoal(userId: string, goalId: string, data: Partial<IGoal>) {
    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) {
      throw new AppError('Goal not found', 404);
    }

    Object.assign(goal, data);
    if (goal.savedAmount >= goal.targetAmount) {
      goal.isCompleted = true;
    }
    await goal.save();
    return goal;
  }

  static async deleteGoal(userId: string, goalId: string) {
    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) {
      throw new AppError('Goal not found', 404);
    }

    await goal.deleteOne();
    return { success: true, message: 'Goal deleted successfully' };
  }

  // ============================================================
  // DASHBOARD
  // ============================================================

  static async getDashboard(userId: string, month: string) {
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get all transactions for the month
    const transactions = await Transaction.find({
      userId,
      date: { $gte: startDate, $lte: endDate },
      isDeleted: false
    }).sort({ date: -1 });

    let totalExpense = 0;
    let totalIncome = 0;
    const categorySpending: Record<string, { spent: number; budget: number }> = {};

    transactions.forEach(t => {
      if (t.type === 'expense') {
        totalExpense += t.amount;
        if (!categorySpending[t.category]) {
          categorySpending[t.category] = { spent: 0, budget: 0 };
        }
        categorySpending[t.category].spent += t.amount;
      } else if (t.type === 'income') {
        totalIncome += t.amount;
      }
    });

    // Get Budget
    const budget = await Budget.findOne({ userId, month });
    const totalBudget = budget?.totalBudget || 0;

    // Populate category budgets
    const categoryBudgets = budget?.categoryBudgets || [];
    const categorySpendingArray = Object.keys(categorySpending).map(cat => ({
      category: cat,
      spent: categorySpending[cat].spent,
      budget: categoryBudgets.find(b => b.category === cat)?.amount || 0,
    }));

    // Get goals & bills
    const [goals, bills] = await Promise.all([
      Goal.find({ userId, isCompleted: false }).sort({ targetDate: 1 }),
      Bill.find({ userId, isActive: true }).sort({ dueDate: 1 }),
    ]);

    return {
      monthlyOverview: {
        totalExpense,
        totalIncome,
        savings: totalIncome - totalExpense,
        budget: totalBudget,
        budgetUsedPercentage: totalBudget > 0 ? (totalExpense / totalBudget) * 100 : 0,
      },
      categorySpending: categorySpendingArray,
      recentTransactions: transactions.slice(0, 10),
      goals,
      bills,
      // Additional stats
      stats: {
        transactionCount: transactions.length,
        expenseCount: transactions.filter(t => t.type === 'expense').length,
        incomeCount: transactions.filter(t => t.type === 'income').length,
        averageDailyExpense: totalExpense / (new Date().getDate() || 1),
      }
    };
  }
}


// import { Transaction, Budget, Bill, Goal, ITransaction } from './finance.model';

// export class FinanceService {
//   // ============================================================
//   // TRANSACTIONS
//   // ============================================================

//   static async addTransaction(userId: string, data: Partial<ITransaction>) {
//     const transaction = new Transaction({ ...data, userId });
//     await transaction.save();

//     // If it's an expense, update the budget for that month
//     if (data.type === 'expense') {
//       const month = new Date(data.date || Date.now()).toISOString().substring(0, 7); // YYYY-MM
//       const amount = data.amount || 0;
//       // We don't automatically deduct from total spent here unless we query the budget on read,
//       // or we can just calculate totalSpent dynamically on the dashboard.
//     }

//     return transaction;
//   }

//   static async getTransactions(userId: string, filters: any = {}) {
//     const query: any = { userId };
    
//     if (filters.type) query.type = filters.type;
//     if (filters.category) query.category = filters.category;
//     if (filters.month) {
//       // filters.month is YYYY-MM
//       const startDate = new Date(`${filters.month}-01T00:00:00Z`);
//       const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
//       query.date = { $gte: startDate, $lte: endDate };
//     }

//     return Transaction.find(query).sort({ date: -1, createdAt: -1 });
//   }

//   // ============================================================
//   // BUDGET
//   // ============================================================

//   static async setBudget(userId: string, month: string, totalBudget: number, categoryBudgets: any[]) {
//     return Budget.findOneAndUpdate(
//       { userId, month },
//       { totalBudget, categoryBudgets },
//       { upsert: true, new: true }
//     );
//   }

//   static async getBudget(userId: string, month: string) {
//     return Budget.findOne({ userId, month });
//   }

//   // ============================================================
//   // DASHBOARD
//   // ============================================================

//   static async getDashboard(userId: string, month: string) {
//     // 1. Get transactions for the month
//     const startDate = new Date(`${month}-01T00:00:00Z`);
//     const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);

//     const transactions = await Transaction.find({
//       userId,
//       date: { $gte: startDate, $lte: endDate }
//     }).sort({ date: -1 });

//     let totalExpense = 0;
//     let totalIncome = 0;
//     const categorySpending: Record<string, number> = {};

//     transactions.forEach(t => {
//       if (t.type === 'expense') {
//         totalExpense += t.amount;
//         categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
//       } else if (t.type === 'income') {
//         totalIncome += t.amount;
//       }
//     });

//     // 2. Get Budget
//     const budget = await Budget.findOne({ userId, month });
    
//     // 3. Get Goals & Bills (simplified for now)
//     const goals = await Goal.find({ userId, isCompleted: false });
//     const bills = await Bill.find({ userId, isActive: true });

//     return {
//       monthlyOverview: {
//         totalExpense,
//         totalIncome,
//         savings: totalIncome - totalExpense,
//         budget: budget?.totalBudget || 0,
//         budgetUsedPercentage: budget?.totalBudget ? (totalExpense / budget.totalBudget) * 100 : 0,
//       },
//       categorySpending: Object.keys(categorySpending).map(cat => ({
//         category: cat,
//         spent: categorySpending[cat],
//         budget: budget?.categoryBudgets.find(b => b.category === cat)?.amount || 0
//       })),
//       recentTransactions: transactions.slice(0, 10),
//       goals,
//       bills
//     };
//   }
// }
