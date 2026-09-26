import { Schema, model, Document } from 'mongoose';

export interface IAppRelease extends Document {
  platform: 'android' | 'ios' | 'web';
  version: string;
  buildNumber?: number;
  downloadUrl: string;
  displayLabel?: string;
  releaseNotes?: string;
  isActive: boolean;
  forceUpdate?: boolean;
  minSupportedVersion?: string;
  releasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AppReleaseSchema = new Schema<IAppRelease>(
  {
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      required: true,
      default: 'android',
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    buildNumber: {
      type: Number,
      default: 1,
    },
    downloadUrl: {
      type: String,
      required: true,
      trim: true,
    },
    displayLabel: {
      type: String,
      default: 'Download Latest Android APK',
    },
    releaseNotes: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    forceUpdate: {
      type: Boolean,
      default: false,
    },
    minSupportedVersion: {
      type: String,
      default: '1.0.0',
    },
    releasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'app_releases',
  }
);

AppReleaseSchema.index({ platform: 1, isActive: 1, releasedAt: -1 });

export const AppRelease = model<IAppRelease>('AppRelease', AppReleaseSchema);
