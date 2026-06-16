import mongoose, { Document } from 'mongoose';
export interface IGroupMember {
    userId: mongoose.Types.ObjectId;
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    joinedAt: Date;
    invitedBy?: mongoose.Types.ObjectId;
    invitationStatus: 'ACCEPTED' | 'PENDING' | 'DECLINED';
    preferences?: {
        customCategory?: string;
        colorCode?: string;
        notificationSettings?: {
            muteGroup: boolean;
            muteExpenses: boolean;
        };
    };
    balance: {
        totalOwed: mongoose.Types.Decimal128;
        totalLent: mongoose.Types.Decimal128;
        netBalance: mongoose.Types.Decimal128;
    };
}
export interface IGroup extends Document {
    groupId: string;
    name: string;
    description?: string;
    avatar?: string;
    type: 'TRIP' | 'HOUSEHOLD' | 'TEAM' | 'EVENT' | 'PROJECT' | 'CUSTOM';
    members: IGroupMember[];
    createdBy: mongoose.Types.ObjectId;
    settings: {
        defaultCurrency: string;
        defaultSplitType: 'EQUAL' | 'PROPORTIONAL';
        enableReceiptScanning: boolean;
        enableAutoSettlement: boolean;
        settlementThreshold: number;
        allowedPaymentMethods: string[];
        categories: string[];
        customCategories?: string[];
        isPublic: boolean;
        inviteCode?: string;
    };
    financialSummary: {
        totalExpenses: number;
        totalSettled: mongoose.Types.Decimal128;
        totalPending: mongoose.Types.Decimal128;
        lastExpenseDate?: Date;
        averageExpenseAmount: mongoose.Types.Decimal128;
        mostActiveMember?: mongoose.Types.ObjectId;
        expenseCount: number;
    };
    tags: string[];
    isActive: boolean;
    isArchived: boolean;
    archivedAt?: Date;
    archivedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Group: mongoose.Model<any, {}, {}, {}, any, any>;
//# sourceMappingURL=group.model.d.ts.map