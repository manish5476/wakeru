import { Document, Types } from 'mongoose';
export type PaymentStatus = 'pending' | 'initiated' | 'confirmed' | 'disputed';
export interface ISettlementTransaction {
    from: string;
    fromName: string;
    to: string;
    toName: string;
    amountBase: number;
    baseCurrency: string;
    status: PaymentStatus;
    upiDeepLink?: string;
    paymentId?: Types.ObjectId;
    initiatedAt?: Date;
    confirmedAt?: Date;
}
export interface ISettlement extends Document {
    tripId: Types.ObjectId;
    transactions: ISettlementTransaction[];
    totalTransactions: number;
    calculatedAt: Date;
    isStale: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Settlement: import("mongoose").Model<ISettlement, {}, {}, {}, Document<unknown, {}, ISettlement, {}, {}> & ISettlement & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=settlement.model.d.ts.map