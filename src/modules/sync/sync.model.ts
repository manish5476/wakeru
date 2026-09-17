import { Schema, model, Document } from 'mongoose';

export interface ISyncLog extends Document {
  clientOperationId: string;
  userId: string;
  entityType: 'trip' | 'expense' | 'settlement';
  entityId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  status: 'APPLIED' | 'CONFLICT' | 'VALIDATION_ERROR';
  resultPayload?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const syncLogSchema = new Schema<ISyncLog>(
  {
    clientOperationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['trip', 'expense', 'settlement'],
      required: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    operationType: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE'],
      required: true,
    },
    status: {
      type: String,
      enum: ['APPLIED', 'CONFLICT', 'VALIDATION_ERROR'],
      default: 'APPLIED',
    },
    resultPayload: {
      type: Schema.Types.Mixed,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

syncLogSchema.index({ userId: 1, createdAt: -1 });

export const SyncLog = model<ISyncLog>('SyncLog', syncLogSchema);
