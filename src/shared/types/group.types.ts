import { Types } from 'mongoose';

export interface IGroupMember {
  userId: Types.ObjectId;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: Date;
  invitedBy?: Types.ObjectId;
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
    totalOwed: number;
    totalLent: number;
    netBalance: number;
  };
}

export interface IGroup {
  groupId: string;
  name: string;
  description?: string;
  avatar?: string;
  
  // Group type
  type: 'TRIP' | 'HOUSEHOLD' | 'TEAM' | 'EVENT' | 'PROJECT' | 'CUSTOM';
  
  // Members
  members: IGroupMember[];
  createdBy: Types.ObjectId;
  
  // Settings
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
  
  // Financial Summary
  financialSummary: {
    totalExpenses: number;
    totalSettled: number;
    totalPending: number;
    lastExpenseDate?: Date;
    averageExpenseAmount: number;
    mostActiveMember?: Types.ObjectId;
  };
  
  // Status
  isActive: boolean;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGroupDTO {
  name: string;
  description?: string;
  type: IGroup['type'];
  avatar?: string;
  settings?: Partial<IGroup['settings']>;
  memberIds?: string[];
}

export interface UpdateGroupDTO {
  name?: string;
  description?: string;
  avatar?: string;
  settings?: Partial<IGroup['settings']>;
}

export interface AddMemberDTO {
  userId: string;
  role?: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface GroupInvitationDTO {
  groupId: string;
  email: string;
  message?: string;
}