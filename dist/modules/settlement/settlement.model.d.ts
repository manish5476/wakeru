import mongoose, { Document } from 'mongoose';
export interface ISettlementDocument extends Document {
    settlementId: string;
    groupId: mongoose.Types.ObjectId;
    fromUser: mongoose.Types.ObjectId;
    toUser: mongoose.Types.ObjectId;
    amount: mongoose.Types.Decimal128;
    currency: string;
    expenses: mongoose.Types.ObjectId[];
    paymentMethod: string;
    paymentDetails?: {
        transactionId?: string;
        upiReference?: string;
        bankReference?: string;
        walletTransactionId?: string;
        paymentGateway: string;
        paidAt: Date;
    };
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    statusHistory: Array<{
        status: string;
        timestamp: Date;
        updatedBy: mongoose.Types.ObjectId;
        remarks?: string;
    }>;
    notes?: string;
    createdBy: mongoose.Types.ObjectId;
    settlementDate: Date;
    completedAt?: Date;
    idempotencyKey: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Settlement: mongoose.Model<ISettlementDocument, {}, {}, {}, mongoose.Document<unknown, {}, ISettlementDocument, {}, {}> & ISettlementDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=settlement.model.d.ts.map