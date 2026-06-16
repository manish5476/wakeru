import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

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

const GroupMemberSchema = new Schema<IGroupMember>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { 
    type: String, 
    enum: ['ADMIN', 'MEMBER', 'VIEWER'], 
    default: 'MEMBER' 
  },
  joinedAt: { type: Date, default: Date.now },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  invitationStatus: { 
    type: String, 
    enum: ['ACCEPTED', 'PENDING', 'DECLINED'],
    default: 'ACCEPTED'
  },
  preferences: {
    customCategory: String,
    colorCode: String,
    notificationSettings: {
      muteGroup: { type: Boolean, default: false },
      muteExpenses: { type: Boolean, default: false }
    }
  },
  balance: {
    totalOwed: { type: Schema.Types.Decimal128, default: 0 },
    totalLent: { type: Schema.Types.Decimal128, default: 0 },
    netBalance: { type: Schema.Types.Decimal128, default: 0 }
  }
});

const GroupSchema = new Schema<IGroup>({
  groupId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => crypto.randomUUID()
  },
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { 
    type: String,
    maxlength: 500
  },
  avatar: String,
  type: { 
    type: String, 
    enum: ['TRIP', 'HOUSEHOLD', 'TEAM', 'EVENT', 'PROJECT', 'CUSTOM'],
    default: 'CUSTOM'
  },
  members: [GroupMemberSchema],
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  settings: {
    defaultCurrency: { type: String, default: 'INR' },
    defaultSplitType: { 
      type: String, 
      enum: ['EQUAL', 'PROPORTIONAL'],
      default: 'PROPORTIONAL'
    },
    enableReceiptScanning: { type: Boolean, default: true },
    enableAutoSettlement: { type: Boolean, default: false },
    settlementThreshold: { type: Number, default: 500 },
    allowedPaymentMethods: [{ type: String }],
    categories: [{ type: String }],
    customCategories: [{ type: String }],
    isPublic: { type: Boolean, default: false },
    inviteCode: { type: String, unique: true, sparse: true }
  },
  financialSummary: {
    totalExpenses: { type: Number, default: 0 },
    totalSettled: { type: Schema.Types.Decimal128, default: 0 },
    totalPending: { type: Schema.Types.Decimal128, default: 0 },
    lastExpenseDate: Date,
    averageExpenseAmount: { type: Schema.Types.Decimal128, default: 0 },
    mostActiveMember: { type: Schema.Types.ObjectId, ref: 'User' },
    expenseCount: { type: Number, default: 0 }
  },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  archivedAt: Date,
  archivedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret: { [key: string]: any }) => {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
GroupSchema.index({ groupId: 1 });
GroupSchema.index({ 'members.userId': 1 });
GroupSchema.index({ createdBy: 1 });
GroupSchema.index({ 'settings.inviteCode': 1 });
GroupSchema.index({ type: 1, isActive: 1 });
GroupSchema.index({ 'financialSummary.lastExpenseDate': -1 });

// Virtual for member count
GroupSchema.virtual('memberCount').get(function() {
  return this.members.filter(m => m.invitationStatus === 'ACCEPTED').length;
});

// Pre-save hook to generate invite code
GroupSchema.pre('save', function(next) {
  if (this.settings.isPublic && !this.settings.inviteCode) {
    this.settings.inviteCode = crypto.randomBytes(8).toString('hex').toUpperCase();
  }
  next();
});

export const Group = mongoose.models.Group || mongoose.model<IGroup>('Group', GroupSchema);