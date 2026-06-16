import { Types } from 'mongoose';
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
export declare class ExpenseCalculator {
    /**
     * Calculate proportional itemized splits
     * This is the CORE algorithm that makes WAKERU superior
     */
    calculateProportionalSplit(lineItems: LineItemInput[], taxes: TaxInput[], discounts: DiscountInput[], paidBy: string, currency: string): {
        splits: SplitResult[];
        analytics: any;
        totals: {
            subTotal: Types.Decimal128;
            taxTotal: Types.Decimal128;
            discountTotal: Types.Decimal128;
            totalAmount: Types.Decimal128;
        };
    };
    /**
     * Calculate equal split (for simple cases)
     */
    calculateEqualSplit(totalAmount: number, consumerIds: string[], paidBy: string, taxes?: TaxInput[], discounts?: DiscountInput[]): SplitResult[];
    /**
     * Generate consumption analytics
     */
    private generateAnalytics;
    /**
     * Validate expense data
     */
    validateExpense(lineItems: LineItemInput[], taxes: TaxInput[]): {
        isValid: boolean;
        errors: string[];
    };
}
export declare const expenseCalculator: ExpenseCalculator;
export {};
//# sourceMappingURL=expense.calculator.d.ts.map