import mongoose, { Schema, Document } from 'mongoose';

export interface IMedia extends Document {
  url: string;
  publicId: string;
  uploadedBy: string;
  purpose: string;
  size: number;
  format: string;
  createdAt: Date;
}

const MediaSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: String,
      ref: 'User',
      required: true,
    },
    purpose: {
      type: String,
      enum: ['profile_picture', 'receipt_image', 'group_avatar', 'general'],
      default: 'general',
    },
    size: {
      type: Number,
      required: true,
    },
    format: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Media = mongoose.model<IMedia>('Media', MediaSchema);
