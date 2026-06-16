import { Types, Decimal128 } from 'mongoose';

export interface ILineItem {
  itemId: string;
  name: string;
  category: string;
  basePrice: Decimal128;
  quantity: number;
  unit?: string;
  consumers: IConsumer[];
}

export interface IConsumer {
  userId: Types.ObjectId;
  consumptionPercentage: number; // 0-100
  quantity?: number;
  notes?: string;
}

export interface ITax {
  name: string;
  percentage: number;
  amount: Decimal128;
  applicableTo: 'all' | 'specific';
  applicableItems?: string[];
  taxCode?: string; // e.g., "GST-18"
}

export interface IDiscount {
  type: 'percentage' | 'fixed';
  value: Decimal128;
  code?: string;
  description?: string;
  applicableTo: 'all' | 'specific';
  applicableItems?: string[];
}

export interface ISplit {
  userId: Types.ObjectId;
  baseAmount: Decimal128;
  taxAmount: Decimal128;
  discountAmount: Decimal128;
  finalAmount: Decimal128;
  isPayer: boolean;
  items: ISplitItem[];
  settlementStatus: 'PENDING' | 'SETTLED' | 'PARTIAL';
}

export interface ISplitItem {
  itemId: string;
  name: string;
  category: string;
  amount: Decimal128;
  quantity: number;
  consumptionPercent: number;
}

export interface IExpense {
  expenseId: string;
  groupId: Types.ObjectId;
  description: string;
  category: string;
  currency: string;
  
  lineItems: ILineItem[];
  taxes: ITax[];
  discounts: IDiscount[];
  splits: ISplit[];
  
  paidBy: Types.ObjectId;
  paymentMethod: string;
  paymentDate: Date;
  
  totalAmount: Decimal128;
  subTotal: Decimal128;
  taxTotal: Decimal128;
  discountTotal: Decimal128;
  
  analytics?: {
    categoryBreakdown: Map<string, {
      totalAmount: Decimal128;
      itemCount: number;
      consumerCount: number;
    }>;
    averagePerPerson: Decimal128;
    mostExpensiveItem?: {
      name: string;
      amount: Decimal128;
    };
    consumptionDistribution: Array<{
      userId: Types.ObjectId;
      percentage: number;
    }>;
  };
  
  receipt?: {
    imageUrl: string;
    thumbnailUrl: string;
    ocrProcessed: boolean;
    ocrConfidence?: number;
    ocrData?: any;
    uploadedAt: Date;
  };
  
  metadata: {
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    isDeleted: boolean;
    deletedBy?: Types.ObjectId;
    deletedAt?: Date;
    version: number;
  };
  
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseDTO {
  groupId: string;
  description: string;
  category: string;
  currency: string;
  lineItems: {
    name: string;
    category: string;
    basePrice: number;
    quantity: number;
    consumers: {
      userId: string;
      consumptionPercentage: number;
      quantity?: number;
      notes?: string;
    }[];
  }[];
  taxes?: {
    name: string;
    percentage: number;
    applicableTo: 'all' | 'specific';
    applicableItems?: string[];
    taxCode?: string;
  }[];
  discounts?: {
    type: 'percentage' | 'fixed';
    value: number;
    applicableTo: 'all' | 'specific';
    applicableItems?: string[];
    code?: string;
    description?: string;
  }[];
  paidBy: string;
  paymentMethod: string;
  paymentDate?: Date;
  receiptImage?: File;
  idempotencyKey?: string;
}

export interface UpdateExpenseDTO {
  description?: string;
  category?: string;
  lineItems?: CreateExpenseDTO['lineItems'];
  taxes?: CreateExpenseDTO['taxes'];
  discounts?: CreateExpenseDTO['discounts'];
}
