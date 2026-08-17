import { Types } from 'mongoose';
import Decimal from 'decimal.js';

interface LineItemInput {
  itemId: string;
  name: string;
  category: string;
  basePrice: number;
  quantity: number;
  unit?: string;
  consumers: {
    userId: string;
    consumptionPercentage: number;
    quantity?: number;
    notes?: string;
  }[];
}

interface TaxInput {
  name: string;
  percentage: number;
  applicableTo: 'all' | 'specific';
  applicableItems?: string[];
  taxCode?: string;
}

interface DiscountInput {
  type: 'percentage' | 'fixed';
  value: number;
  code?: string;
  description?: string;
  applicableTo: 'all' | 'specific';
  applicableItems?: string[];
}

interface SplitResult {
  userId: Types.ObjectId;
  baseAmount: Types.Decimal128;
  taxAmount: Types.Decimal128;
  discountAmount: Types.Decimal128;
  finalAmount: Types.Decimal128;
  isPayer: boolean;
  items: {
    itemId: string;
    name: string;
    category: string;
    amount: Types.Decimal128;
    consumptionPercent: number;
  }[];
  settlementStatus: 'PENDING';
}

export class ExpenseCalculator {
  /**
   * Calculate proportional itemized splits
   * This is the CORE algorithm that makes WAKERU superior
   */
  calculateProportionalSplit(
    lineItems: LineItemInput[],
    taxes: TaxInput[],
    discounts: DiscountInput[],
    paidBy: string,
    currency: string
  ): {
    splits: SplitResult[];
    analytics: any;
    totals: {
      subTotal: Types.Decimal128;
      taxTotal: Types.Decimal128;
      discountTotal: Types.Decimal128;
      totalAmount: Types.Decimal128;
    };
  } {
    const userConsumption = new Map<string, {
      baseAmount: Decimal;
      taxAmount: Decimal;
      discountAmount: Decimal;
      items: any[];
    }>();

    // Initialize all consumers
    lineItems.forEach(item => {
      item.consumers.forEach(consumer => {
        if (!userConsumption.has(consumer.userId)) {
          userConsumption.set(consumer.userId, {
            baseAmount: new Decimal(0),
            taxAmount: new Decimal(0),
            discountAmount: new Decimal(0),
            items: []
          });
        }
      });
    });

    // Step 1: Calculate base consumption
    lineItems.forEach(item => {
      const itemPrice = new Decimal(item.basePrice);
      
      item.consumers.forEach(consumer => {
        const userId = consumer.userId;
        const userData = userConsumption.get(userId)!;
        
        // Calculate proportional amount
        const consumptionAmount = itemPrice.times(consumer.consumptionPercentage).dividedBy(100);
        
        userData.baseAmount = userData.baseAmount.plus(consumptionAmount);
        
        userData.items.push({
          itemId: item.itemId,
          name: item.name,
          category: item.category,
          amount: Types.Decimal128.fromString(consumptionAmount.toFixed(2)),
          consumptionPercent: consumer.consumptionPercentage
        });
      });
    });

    // Step 2: Calculate proportional tax distribution
    taxes.forEach(tax => {
      const taxRate = new Decimal(tax.percentage).dividedBy(100);
      
      lineItems.forEach(item => {
        // Check if tax applies to this item
        if (tax.applicableTo === 'specific' && 
            tax.applicableItems && 
            !tax.applicableItems.includes(item.itemId)) {
          return;
        }

        const itemPrice = new Decimal(item.basePrice);
        
        item.consumers.forEach(consumer => {
          const userId = consumer.userId;
          const userData = userConsumption.get(userId)!;
          
          // Tax is proportional to consumption
          const consumerBase = itemPrice.times(consumer.consumptionPercentage).dividedBy(100);
          const taxOnItem = consumerBase.times(taxRate);
          
          userData.taxAmount = userData.taxAmount.plus(taxOnItem);
        });
      });
    });

    // Step 3: Calculate proportional discount distribution
    const totalBaseAmount = lineItems.reduce(
      (sum, item) => sum.plus(new Decimal(item.basePrice)), 
      new Decimal(0)
    );

    discounts.forEach(discount => {
      let totalDiscountValue: Decimal;
      
      if (discount.type === 'fixed') {
        totalDiscountValue = new Decimal(discount.value);
      } else {
        totalDiscountValue = totalBaseAmount.times(new Decimal(discount.value).dividedBy(100));
      }

      // Calculate discount per item based on item weight
      const applicableItems = lineItems.filter(item => {
        if (discount.applicableTo === 'specific' && 
            discount.applicableItems && 
            !discount.applicableItems.includes(item.itemId)) {
          return false;
        }
        return true;
      });

      const applicableTotal = applicableItems.reduce(
        (sum, item) => sum.plus(new Decimal(item.basePrice)), 
        new Decimal(0)
      );

      applicableItems.forEach(item => {
        const itemWeight = new Decimal(item.basePrice).dividedBy(applicableTotal);
        const itemDiscount = totalDiscountValue.times(itemWeight);

        item.consumers.forEach(consumer => {
          const userId = consumer.userId;
          const userData = userConsumption.get(userId)!;
          
          // Discount is proportional to consumption
          const consumerDiscount = itemDiscount.times(consumer.consumptionPercentage).dividedBy(100);
          userData.discountAmount = userData.discountAmount.plus(consumerDiscount);
        });
      });
    });

    // Step 4: Calculate final amounts with precision
    const splits: SplitResult[] = [];
    let totalSubTotal = new Decimal(0);
    let totalTax = new Decimal(0);
    let totalDiscount = new Decimal(0);

    for (const [userId, data] of userConsumption) {
      const finalAmount = data.baseAmount.plus(data.taxAmount).minus(data.discountAmount);
      const roundedFinal = finalAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      splits.push({
        userId: new Types.ObjectId(userId),
        baseAmount: Types.Decimal128.fromString(data.baseAmount.toFixed(2)),
        taxAmount: Types.Decimal128.fromString(data.taxAmount.toFixed(2)),
        discountAmount: Types.Decimal128.fromString(data.discountAmount.toFixed(2)),
        finalAmount: Types.Decimal128.fromString(roundedFinal.toFixed(2)),
        isPayer: userId === paidBy,
        items: data.items,
        settlementStatus: 'PENDING'
      });

      totalSubTotal = totalSubTotal.plus(data.baseAmount);
      totalTax = totalTax.plus(data.taxAmount);
      totalDiscount = totalDiscount.plus(data.discountAmount);
    }

    // Step 5: Generate consumption analytics
    const analytics = this.generateAnalytics(splits, lineItems);

    return {
      splits,
      analytics,
      totals: {
        subTotal: Types.Decimal128.fromString(totalSubTotal.toFixed(2)),
        taxTotal: Types.Decimal128.fromString(totalTax.toFixed(2)),
        discountTotal: Types.Decimal128.fromString(totalDiscount.toFixed(2)),
        totalAmount: Types.Decimal128.fromString(
          totalSubTotal.plus(totalTax).minus(totalDiscount).toFixed(2)
        )
      }
    };
  }

  /**
   * Calculate equal split (for simple cases)
   */
  calculateEqualSplit(
    totalAmount: number,
    consumerIds: string[],
    paidBy: string,
    taxes: TaxInput[] = [],
    discounts: DiscountInput[] = []
  ): SplitResult[] {
    const consumerCount = consumerIds.length;
    const amount = new Decimal(totalAmount);
    const perPerson = amount.dividedBy(consumerCount).toDecimalPlaces(2, Decimal.ROUND_FLOOR);
    
    // Handle penny rounding
    const remainder = amount.minus(perPerson.times(consumerCount));
    
    return consumerIds.map((userId, index) => {
      let finalAmount = perPerson;
      
      // Distribute remainder to first few people
      if (index < remainder.toNumber() * 100) {
        finalAmount = finalAmount.plus(0.01);
      }

      return {
        userId: new Types.ObjectId(userId),
        baseAmount: Types.Decimal128.fromString(finalAmount.toFixed(2)),
        taxAmount: Types.Decimal128.fromString('0'),
        discountAmount: Types.Decimal128.fromString('0'),
        finalAmount: Types.Decimal128.fromString(finalAmount.toFixed(2)),
        isPayer: userId === paidBy,
        items: [],
        settlementStatus: 'PENDING'
      };
    });
  }

  /**
   * Generate consumption analytics
   */
  private generateAnalytics(splits: SplitResult[], lineItems: LineItemInput[]) {
    const categoryConsumption = new Map<string, {
      totalAmount: number;
      itemCount: number;
      consumerCount: Set<string>;
    }>();

    splits.forEach(split => {
      split.items.forEach(item => {
        const category = item.category;
        
        if (!categoryConsumption.has(category)) {
          categoryConsumption.set(category, {
            totalAmount: 0,
            itemCount: 0,
            consumerCount: new Set()
          });
        }
        
        const catData = categoryConsumption.get(category)!;
        catData.totalAmount += parseFloat(item.amount.toString());
        catData.itemCount++;
        catData.consumerCount.add(split.userId.toString());
      });
    });

    // Convert to plain object
    const categoryBreakdown: any = {};
    categoryConsumption.forEach((value, key) => {
      categoryBreakdown[key] = {
        totalAmount: Types.Decimal128.fromString(value.totalAmount.toFixed(2)),
        itemCount: value.itemCount,
        consumerCount: value.consumerCount.size
      };
    });

    // Find most expensive item
    let mostExpensiveItem = null;
    let maxPrice = 0;

    lineItems.forEach(item => {
      const price = item.basePrice;
      if (price > maxPrice) {
        maxPrice = price;
        mostExpensiveItem = {
          name: item.name,
          amount: Types.Decimal128.fromString(price.toString())
        };
      }
    });

    // Calculate consumption distribution
    const totalAmount = splits.reduce(
      (sum, split) => sum + parseFloat(split.finalAmount.toString()), 
      0
    );

    const consumptionDistribution = splits.map(split => ({
      userId: split.userId,
      percentage: totalAmount > 0 
        ? Math.round((parseFloat(split.finalAmount.toString()) / totalAmount) * 10000) / 100
        : 0
    }));

    return {
      categoryBreakdown,
      averagePerPerson: Types.Decimal128.fromString(
        (totalAmount / (splits.length || 1)).toFixed(2)
      ),
      mostExpensiveItem,
      consumptionDistribution
    };
  }

  /**
   * Validate expense data
   */
  validateExpense(lineItems: LineItemInput[], taxes: TaxInput[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!lineItems || lineItems.length === 0) {
      errors.push('At least one line item is required');
      return { isValid: false, errors };
    }

    // Validate consumption percentages
    lineItems.forEach((item, index) => {
      const totalPercentage = item.consumers.reduce(
        (sum, c) => sum + c.consumptionPercentage, 
        0
      );

      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.push(
          `Line item "${item.name}": Consumption percentages must total 100% (current: ${totalPercentage}%)`
        );
      }

      if (item.basePrice <= 0) {
        errors.push(`Line item "${item.name}": Price must be greater than 0`);
      }

      if (item.quantity < 1) {
        errors.push(`Line item "${item.name}": Quantity must be at least 1`);
      }
    });

    // Validate tax percentages
    taxes.forEach((tax, index) => {
      if (tax.percentage < 0 || tax.percentage > 100) {
        errors.push(`Tax "${tax.name}": Percentage must be between 0 and 100`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const expenseCalculator = new ExpenseCalculator();