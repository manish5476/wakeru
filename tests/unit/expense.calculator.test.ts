import { ExpenseCalculator } from '../../src/modules/expense/expense.calculator';

describe('ExpenseCalculator', () => {
  it('should be defined', () => {
    expect(new ExpenseCalculator()).toBeDefined();
  });
});
