import { Request, Response, NextFunction } from 'express';
import { FinanceService } from './finance.service';
import { AppError } from '../../shared/errors/AppError';

const getUser = (req: Request) => {
  const user = (req as any).user;
  if (!user?.userId) throw new AppError('Not authenticated', 401);
  return user.userId;
};

export class FinanceController {

  // ============================================================
  // DASHBOARD & ANALYTICS
  // ============================================================

  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const month = req.query.month as string | undefined;
      const includeTripExpenses = req.query.includeTripExpenses !== 'false';
      const dashboard = await FinanceService.getDashboard(userId, month, includeTripExpenses);
      res.status(200).json({ success: true, data: dashboard });
    } catch (error) { next(error); }
  }

  static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const filters = {
        period: req.query.period as any,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };
      const analytics = await FinanceService.getAnalytics(userId, filters);
      res.status(200).json({ success: true, data: analytics });
    } catch (error) { next(error); }
  }

  static async syncTripExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const result = await FinanceService.syncTripExpenses(userId);
      res.status(200).json({ success: true, message: 'Trip expenses synced', data: result });
    } catch (error) { next(error); }
  }

  // ============================================================
  // TRANSACTIONS
  // ============================================================

  static async createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const transaction = await FinanceService.createTransaction(userId, req.body);
      res.status(201).json({ success: true, data: transaction });
    } catch (error) { next(error); }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const result = await FinanceService.getTransactions(userId, req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  static async getTransactionById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const transaction = await FinanceService.getTransactionById(userId, req.params.id);
      res.status(200).json({ success: true, data: transaction });
    } catch (error) { next(error); }
  }

  static async updateTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const transaction = await FinanceService.updateTransaction(userId, req.params.id, req.body);
      res.status(200).json({ success: true, data: transaction });
    } catch (error) { next(error); }
  }

  static async deleteTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const permanent = req.query.permanent === 'true';
      const result = await FinanceService.deleteTransaction(userId, req.params.id, permanent);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  static async restoreTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const transaction = await FinanceService.restoreTransaction(userId, req.params.id);
      res.status(200).json({ success: true, data: transaction });
    } catch (error) { next(error); }
  }

  // ============================================================
  // BUDGET
  // ============================================================

  static async setBudget(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { month, totalBudget, categoryBudgets } = req.body;
      const budget = await FinanceService.setBudget(userId, month, totalBudget, categoryBudgets);
      res.status(200).json({ success: true, data: budget });
    } catch (error) { next(error); }
  }

  static async getBudget(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const month = req.query.month as string || new Date().toISOString().substring(0, 7);
      const budget = await FinanceService.getBudget(userId, month);
      res.status(200).json({ success: true, data: budget });
    } catch (error) { next(error); }
  }

  // ============================================================
  // BILLS
  // ============================================================

  static async createBill(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const bill = await FinanceService.createBill(userId, req.body);
      res.status(201).json({ success: true, data: bill });
    } catch (error) { next(error); }
  }

  static async getBills(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const bills = await FinanceService.getBills(userId, req.query as any);
      res.status(200).json({ success: true, data: bills });
    } catch (error) { next(error); }
  }

  static async getBillById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const bill = await FinanceService.getBillById(userId, req.params.id);
      res.status(200).json({ success: true, data: bill });
    } catch (error) { next(error); }
  }

  static async updateBill(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const bill = await FinanceService.updateBill(userId, req.params.id, req.body);
      res.status(200).json({ success: true, data: bill });
    } catch (error) { next(error); }
  }

  static async markBillPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { paidAmount } = req.body;
      const bill = await FinanceService.markBillPaid(userId, req.params.id, paidAmount);
      res.status(200).json({ success: true, data: bill });
    } catch (error) { next(error); }
  }

  static async deleteBill(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const result = await FinanceService.deleteBill(userId, req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  // ============================================================
  // GOALS
  // ============================================================

  static async createGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const goal = await FinanceService.createGoal(userId, req.body);
      res.status(201).json({ success: true, data: goal });
    } catch (error) { next(error); }
  }

  static async getGoals(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const goals = await FinanceService.getGoals(userId, req.query as any);
      res.status(200).json({ success: true, data: goals });
    } catch (error) { next(error); }
  }

  static async getGoalById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const goal = await FinanceService.getGoalById(userId, req.params.id);
      res.status(200).json({ success: true, data: goal });
    } catch (error) { next(error); }
  }

  static async updateGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const goal = await FinanceService.updateGoal(userId, req.params.id, req.body);
      res.status(200).json({ success: true, data: goal });
    } catch (error) { next(error); }
  }

  static async contributeToGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const { amount } = req.body;
      const goal = await FinanceService.contributeToGoal(userId, req.params.id, amount);
      res.status(200).json({ success: true, data: goal });
    } catch (error) { next(error); }
  }

  static async deleteGoal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUser(req);
      const result = await FinanceService.deleteGoal(userId, req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }
}




// // finance.controller.ts
// import { Request, Response, NextFunction } from 'express';
// import { FinanceService } from './finance.service';
// import { AppError } from '../../shared/errors/AppError';

// export class FinanceController {
  
//   // ============================================================
//   // DASHBOARD
//   // ============================================================
  
//   static async getDashboard(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const month = req.query.month as string || new Date().toISOString().substring(0, 7);
//       const dashboard = await FinanceService.getDashboard(user.userId, month);
      
//       res.status(200).json({ success: true, data: dashboard });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ============================================================
//   // TRANSACTIONS
//   // ============================================================

//   static async createTransaction(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const transaction = await FinanceService.createTransaction(user.userId, req.body);
//       res.status(201).json({ success: true, data: transaction });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async getTransactions(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const filters = req.query;
//       const result = await FinanceService.getTransactions(user.userId, filters);
//       res.status(200).json({ success: true, data: result });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async getTransactionById(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const transaction = await FinanceService.getTransactionById(user.userId, id);
//       res.status(200).json({ success: true, data: transaction });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async updateTransaction(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const transaction = await FinanceService.updateTransaction(user.userId, id, req.body);
//       res.status(200).json({ success: true, data: transaction });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async deleteTransaction(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const permanent = req.query.permanent === 'true';
//       const result = await FinanceService.deleteTransaction(user.userId, id, permanent);
//       res.status(200).json({ success: true, data: result });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async restoreTransaction(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const transaction = await FinanceService.restoreTransaction(user.userId, id);
//       res.status(200).json({ success: true, data: transaction });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ============================================================
//   // BUDGET
//   // ============================================================

//   static async setBudget(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { month, totalBudget, categoryBudgets } = req.body;
//       const budget = await FinanceService.setBudget(
//         user.userId, 
//         month, 
//         totalBudget, 
//         categoryBudgets
//       );
//       res.status(200).json({ success: true, data: budget });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async getBudget(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const month = req.query.month as string || new Date().toISOString().substring(0, 7);
//       const budget = await FinanceService.getBudget(user.userId, month);
//       res.status(200).json({ success: true, data: budget });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ============================================================
//   // BILLS
//   // ============================================================

//   static async createBill(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const bill = await FinanceService.createBill(user.userId, req.body);
//       res.status(201).json({ success: true, data: bill });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async getBills(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const filters = req.query;
//       const bills = await FinanceService.getBills(user.userId, filters);
//       res.status(200).json({ success: true, data: bills });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async getBillById(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const bill = await FinanceService.getBillById(user.userId, id);
//       res.status(200).json({ success: true, data: bill });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async updateBill(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const bill = await FinanceService.updateBill(user.userId, id, req.body);
//       res.status(200).json({ success: true, data: bill });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async deleteBill(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const result = await FinanceService.deleteBill(user.userId, id);
//       res.status(200).json({ success: true, data: result });
//     } catch (error) {
//       next(error);
//     }
//   }

//   // ============================================================
//   // GOALS
//   // ============================================================

//   static async createGoal(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const goal = await FinanceService.createGoal(user.userId, req.body);
//       res.status(201).json({ success: true, data: goal });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async getGoals(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const filters = req.query;
//       const goals = await FinanceService.getGoals(user.userId, filters);
//       res.status(200).json({ success: true, data: goals });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async getGoalById(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const goal = await FinanceService.getGoalById(user.userId, id);
//       res.status(200).json({ success: true, data: goal });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async updateGoal(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const goal = await FinanceService.updateGoal(user.userId, id, req.body);
//       res.status(200).json({ success: true, data: goal });
//     } catch (error) {
//       next(error);
//     }
//   }

//   static async deleteGoal(req: Request, res: Response, next: NextFunction) {
//     try {
//       const user = (req as any).user;
//       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
//       const { id } = req.params;
//       const result = await FinanceService.deleteGoal(user.userId, id);
//       res.status(200).json({ success: true, data: result });
//     } catch (error) {
//       next(error);
//     }
//   }
// }

// // import { Request, Response, NextFunction } from 'express';
// // import { FinanceService } from './finance.service';
// // import { AppError } from '../../shared/errors/AppError';

// // export class FinanceController {
  
// //   static async getDashboard(req: Request, res: Response, next: NextFunction) {
// //     try {
// //       const user = (req as any).user;
// //       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
// //       const month = req.query.month as string || new Date().toISOString().substring(0, 7); // Default to current month YYYY-MM
      
// //       const dashboard = await FinanceService.getDashboard(user.userId, month);
// //       res.status(200).json({ success: true, data: dashboard });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   static async addTransaction(req: Request, res: Response, next: NextFunction) {
// //     try {
// //       const user = (req as any).user;
// //       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
// //       const data = req.body;
// //       const transaction = await FinanceService.addTransaction(user.userId, data);
// //       res.status(201).json({ success: true, data: transaction });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   static async getTransactions(req: Request, res: Response, next: NextFunction) {
// //     try {
// //       const user = (req as any).user;
// //       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
// //       const filters = req.query;
// //       const transactions = await FinanceService.getTransactions(user.userId, filters);
// //       res.status(200).json({ success: true, data: { transactions } });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }

// //   static async setBudget(req: Request, res: Response, next: NextFunction) {
// //     try {
// //       const user = (req as any).user;
// //       if (!user?.userId) throw new AppError('Not authenticated', 401);
      
// //       const { month, totalBudget, categoryBudgets } = req.body;
// //       const budget = await FinanceService.setBudget(user.userId, month, totalBudget, categoryBudgets);
// //       res.status(200).json({ success: true, data: { budget } });
// //     } catch (error) {
// //       next(error);
// //     }
// //   }
// // }
