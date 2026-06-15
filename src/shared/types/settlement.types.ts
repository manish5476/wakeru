import { Types, Decimal128 } from 'mongoose';

export interface ISettlement {
  settlementId: string;
  groupId: Types.ObjectId;
  
  // Payment details
  fromUser: Types.ObjectId;
  toUser: Types.ObjectId;
  amount: Decimal128;
  currency: string;
  
  // Related expenses
  expenses: Types.ObjectId[];
  
  // Payment method
  paymentMethod: string;
  paymentDetails?: {
    transactionId?: string;
    upiReference?: string;
    bankReference?: string;
    walletTransactionId?: string;
    paymentGateway: string;
    paidAt: Date;
  };
  
  // Status
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    updatedBy: Types.ObjectId;
    remarks?: string;
  }>;
  
  // Metadata
  notes?: string;
  createdBy: Types.ObjectId;
  settlementDate: Date;
  completedAt?: Date;
  
  // Idempotency
  idempotencyKey: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementRequestDTO {
  groupId: string;
  fromUser: string;
  toUser: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  notes?: string;
}

export interface DebtSummary {
  userId: string;
  owes: Array<{
    to: string;
    amount: number;
    currency: string;
  }>;
  isOwed: Array<{
    from: string;
    amount: number;
    currency: string;
  }>;
  netBalance: number;
}