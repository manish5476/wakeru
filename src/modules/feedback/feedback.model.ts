import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IFeedback extends Document<string> {
  _id: string;
  userId?: string;
  displayName: string;
  rating: number;
  category: 'bug' | 'suggestion' | 'love' | 'other' | 'feature' | 'performance' | 'design';
  feedback: string;
  images?: string[];
  deviceInfo?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      default: 'Anonymous',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    category: {
      type: String,
      enum: ['bug', 'suggestion', 'love', 'other', 'feature', 'performance', 'design'],
      required: true,
    },
    feedback: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    images: {
      type: [String],
      default: [],
    },
    deviceInfo: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false,
  }
);

FeedbackSchema.index({ createdAt: -1 });

export const Feedback = mongoose.model<IFeedback>('Feedback', FeedbackSchema);
