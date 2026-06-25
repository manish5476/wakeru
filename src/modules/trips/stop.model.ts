import { Schema, model, Document, Types } from 'mongoose';

export interface IStop extends Document {
  tripId: Types.ObjectId;
  name: string;
  emoji?: string;
  country?: string;
  location?: {
    lat: number;
    lng: number;
    formattedAddress: string;
  };
  currency: string;
  currentExchangeRate: number;
  rateLastUpdated?: Date;
  budget?: number;
  budgetBase?: number;
  order: number;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  coverImage?: string;
  totalSpentLocal: number;
  totalSpentBase: number;
  expenseCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const stopSchema = new Schema<IStop>(
  {
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'tripId is required for a stop'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Stop name is required'],
      trim: true,
      maxlength: [100, 'Stop name cannot exceed 100 characters'],
    },
    emoji: { type: String },
    country: {
      type: String,
      uppercase: true,
      maxlength: 3,
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      formattedAddress: { type: String },
    },
    currency: {
      type: String,
      required: [true, 'Stop currency is required'],
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    currentExchangeRate: {
      type: Number,
      required: [true, 'Exchange rate is required'],
      default: 1.0,
      min: [0.000001, 'Exchange rate must be positive'],
    },
    rateLastUpdated: { type: Date },
    budget: { type: Number, min: 0 },
    budgetBase: { type: Number, min: 0 },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    coverImage: { type: String, default: 'https://i.pinimg.com/736x/68/11/6b/68116be5b8fcd754b7f811625bd51223.jpg' },
    totalSpentLocal: { type: Number, default: 0 },
    totalSpentBase: { type: Number, default: 0 },
    expenseCount: { type: Number, default: 0, min: 0 },
    createdBy: {
      type: String,
      required: [true, 'Stop createdBy is required'],
    },
  },
  {
    timestamps: true, // gives createdAt + updatedAt on each stop
  }
);

// Auto-compute budgetBase whenever budget or exchange rate changes
stopSchema.pre('save', function (next) {
  if (this.budget !== undefined && this.currentExchangeRate) {
    this.budgetBase = parseFloat((this.budget * this.currentExchangeRate).toFixed(2));
  }
  next();
});

export const Stop = model<IStop>('Stop', stopSchema);
