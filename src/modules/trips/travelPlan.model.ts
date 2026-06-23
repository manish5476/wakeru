import { Schema, model, Document, Types } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface IChecklistItem {
  item: string;
  checked: boolean;
}

export interface IItineraryDay {
  date: string;
  day: string;
  destination: string;
  transport: string;
  accommodation: string;
  notes: string;
}

export interface IFlightDetail {
  type: 'departure' | 'return';
  airline: string;
  flightNo: string;
  from: string;
  to: string;
  date: string;
  time: string;
}

export interface IAccommodationDetail {
  hotelName: string;
  address: string;
  checkIn: string;
  checkOut: string;
  confirmationNo: string;
  contact: string;
  notes: string;
}

export interface ITransportDetail {
  type: 'train' | 'bus' | 'taxi' | 'ferry' | 'cab' | 'other';
  operator: string;
  pnr: string;
  from: string;
  to: string;
  date: string;
  time: string;
  notes: string;
}

export interface IPackingItem {
  name: string;
  checked: boolean;
}

export interface IPackingCategory {
  category: string;
  items: IPackingItem[];
}

export interface ITravelPlan extends Document {
  tripId: Types.ObjectId;
  purpose: string;
  budgetOverview: {
    flights: number;
    accommodation: number;
    transport: number;
    food: number;
    activities: number;
    shopping: number;
    miscellaneous: number;
  };
  checklist: IChecklistItem[];
  itinerary: IItineraryDay[];
  flightDetails: IFlightDetail[];
  accommodationDetails: IAccommodationDetail[];
  transportDetails: ITransportDetail[];
  packingList: IPackingCategory[];
  importantContacts: {
    emergencyContact: string;
    travelInsurance: string;
    hotelContact: string;
    localEmbassy: string;
  };
  notes: string;
  travelGoals: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const TravelPlanSchema = new Schema<ITravelPlan>(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
    purpose: { type: String, default: '' },
    budgetOverview: {
      flights: { type: Number, default: 0 },
      accommodation: { type: Number, default: 0 },
      transport: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      activities: { type: Number, default: 0 },
      shopping: { type: Number, default: 0 },
      miscellaneous: { type: Number, default: 0 },
    },
    checklist: [
      {
        item: { type: String, required: true },
        checked: { type: Boolean, default: false },
      },
    ],
    itinerary: [
      {
        date: { type: String, default: '' },
        day: { type: String, default: '' },
        destination: { type: String, default: '' },
        transport: { type: String, default: '' },
        accommodation: { type: String, default: '' },
        notes: { type: String, default: '' },
      },
    ],
    flightDetails: [
      {
        type: { type: String, enum: ['departure', 'return'], required: true },
        airline: { type: String, default: '' },
        flightNo: { type: String, default: '' },
        from: { type: String, default: '' },
        to: { type: String, default: '' },
        date: { type: String, default: '' },
        time: { type: String, default: '' },
      },
    ],
    accommodationDetails: [
      {
        hotelName: { type: String, default: '' },
        address: { type: String, default: '' },
        checkIn: { type: String, default: '' },
        checkOut: { type: String, default: '' },
        confirmationNo: { type: String, default: '' },
        contact: { type: String, default: '' },
        notes: { type: String, default: '' },
      },
    ],
    transportDetails: [
      {
        type: { type: String, enum: ['train', 'bus', 'taxi', 'ferry', 'cab', 'other'], required: true },
        operator: { type: String, default: '' },
        pnr: { type: String, default: '' },
        from: { type: String, default: '' },
        to: { type: String, default: '' },
        date: { type: String, default: '' },
        time: { type: String, default: '' },
        notes: { type: String, default: '' },
      },
    ],
    packingList: [
      {
        category: { type: String, required: true },
        items: [
          {
            name: { type: String, required: true },
            checked: { type: Boolean, default: false },
          },
        ],
      },
    ],
    importantContacts: {
      emergencyContact: { type: String, default: '' },
      travelInsurance: { type: String, default: '' },
      hotelContact: { type: String, default: '' },
      localEmbassy: { type: String, default: '' },
    },
    notes: { type: String, default: '' },
    travelGoals: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// Indexes
TravelPlanSchema.index({ tripId: 1 });

export const TravelPlan = model<ITravelPlan>('TravelPlan', TravelPlanSchema);
