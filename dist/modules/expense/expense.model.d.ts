import mongoose, { Document } from 'mongoose';
export interface IExpenseDocument extends Document {
    expenseId: string;
    groupId: mongoose.Types.ObjectId;
    description: string;
    category: string;
    currency: string;
    lineItems: Array<{
        itemId: string;
        name: string;
        category: string;
        basePrice: mongoose.Types.Decimal128;
        quantity: number;
        unit?: string;
        consumers: Array<{
            userId: mongoose.Types.ObjectId;
            consumptionPercentage: number;
            quantity?: number;
            notes?: string;
        }>;
    }>;
    taxes: Array<{
        name: string;
        percentage: number;
        amount: mongoose.Types.Decimal128;
        applicableTo: 'all' | 'specific';
        applicableItems?: string[];
        taxCode?: string;
    }>;
    discounts: Array<{
        type: 'percentage' | 'fixed';
        value: mongoose.Types.Decimal128;
        code?: string;
        description?: string;
        applicableTo: 'all' | 'specific';
        applicableItems?: string[];
    }>;
    splits: Array<{
        userId: mongoose.Types.ObjectId;
        baseAmount: mongoose.Types.Decimal128;
        taxAmount: mongoose.Types.Decimal128;
        discountAmount: mongoose.Types.Decimal128;
        finalAmount: mongoose.Types.Decimal128;
        isPayer: boolean;
        items: Array<{
            itemId: string;
            name: string;
            category: string;
            amount: mongoose.Types.Decimal128;
            consumptionPercent: number;
        }>;
        settlementStatus: 'PENDING' | 'SETTLED' | 'PARTIAL';
    }>;
    paidBy: mongoose.Types.ObjectId;
    paymentMethod: string;
    paymentDate: Date;
    totalAmount: mongoose.Types.Decimal128;
    subTotal: mongoose.Types.Decimal128;
    taxTotal: mongoose.Types.Decimal128;
    discountTotal: mongoose.Types.Decimal128;
    analytics: {
        categoryBreakdown: Map<string, {
            totalAmount: mongoose.Types.Decimal128;
            itemCount: number;
            consumerCount: number;
        }>;
        averagePerPerson: mongoose.Types.Decimal128;
        mostExpensiveItem?: {
            name: string;
            amount: mongoose.Types.Decimal128;
        };
        consumptionDistribution: Array<{
            userId: mongoose.Types.ObjectId;
            percentage: number;
        }>;
    };
    receipt?: {
        imageUrl: string;
        thumbnailUrl: string;
        ocrProcessed: boolean;
        ocrConfidence?: number;
        uploadedAt: Date;
    };
    metadata: {
        createdBy: mongoose.Types.ObjectId;
        updatedBy?: mongoose.Types.ObjectId;
        isDeleted: boolean;
        deletedBy?: mongoose.Types.ObjectId;
        deletedAt?: Date;
        version: number;
    };
    idempotencyKey: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Expense: mongoose.Model<IExpenseDocument, {}, {}, {}, mongoose.Document<unknown, {}, IExpenseDocument, {}, {}> & IExpenseDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=expense.model.d.ts.map