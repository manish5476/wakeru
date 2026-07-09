import { Schema, model, Document, Types } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface ICoordinates { 
  lat: number; 
  lng: number; 
}

export interface IChecklistItem {
  _id?: Types.ObjectId;
  item: string;
  checked: boolean;
  dueDate?: Date;
  assignedTo?: string; // Firebase UID
  priority: 'low' | 'medium' | 'high';
  category: 'before-trip' | 'during-trip' | 'after-trip';
}

export interface IItineraryDay {
  _id?: Types.ObjectId;
  date: Date;
  day: string;
  destination: string;
  stopId?: Types.ObjectId;
  location?: ICoordinates;
  weather?: {
    condition: string;
    temperature: number;
    icon: string;
  };
  activities: {
    time: string;
    activity: string;
    location?: string;
    cost?: number;
    currency?: string;
    notes?: string;
  }[];
  transport: string;
  accommodation: string;
  meals: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };
  notes: string;
}

export interface IFlightDetail {
  _id?: Types.ObjectId;
  type: 'departure' | 'return' | 'connecting';
  airline: string;
  flightNo: string;
  from: string;
  to: string;
  fromLocation?: ICoordinates;
  toLocation?: ICoordinates;
  date: Date;
  time: string;
  duration?: string;
  terminal?: string;
  gate?: string;
  bookingRef?: string;
  cost: number;
  currency: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

export interface IAccommodationDetail {
  _id?: Types.ObjectId;
  stopId?: Types.ObjectId;
  hotelName: string;
  address: string;
  location?: ICoordinates;
  checkIn: Date;
  checkOut: Date;
  confirmationNo: string;
  contact: string;
  cost: number;
  currency: string;
  amenities: string[];
  rating?: number;
  notes: string;
}

export interface ITransportDetail {
  _id?: Types.ObjectId;
  type: 'train' | 'bus' | 'taxi' | 'ferry' | 'cab' | 'car rental' | 'other';
  operator: string;
  pnr: string;
  from: string;
  to: string;
  fromLocation?: ICoordinates;
  toLocation?: ICoordinates;
  date: Date;
  time: string;
  duration?: string;
  cost: number;
  currency: string;
  bookingRef?: string;
  notes: string;
}

export interface IPackingItem {
  _id?: Types.ObjectId;
  name: string;
  checked: boolean;
  quantity: number;
  priority: 'essential' | 'recommended' | 'optional';
}

export interface IPackingCategory {
  _id?: Types.ObjectId;
  category: string;
  icon?: string;
  items: Types.DocumentArray<IPackingItem>;
}

export interface IDocumentDetail {
  _id?: Types.ObjectId;
  name: string;
  type: 'passport' | 'visa' | 'insurance' | 'ticket' | 'reservation' | 'vaccination' | 'other';
  fileUrl?: string;
  documentNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
  issuingCountry?: string;
  notes: string;
  verified: boolean;
}

export interface ITravelPlan extends Document {
  tripId: Types.ObjectId;
  
  purpose: string;
  travelStyle: 'budget' | 'comfort' | 'luxury' | 'backpacking' | 'business';
  groupSize: number;
  
  budgetOverview: {
    total: number;
    flights: number;
    accommodation: number;
    transport: number;
    food: number;
    activities: number;
    shopping: number;
    miscellaneous: number;
    currency: string;
    spent: number;
    remaining: number;
  };
  
  // Strongly typing Mongoose Arrays enables the .id() method natively
  checklist: Types.DocumentArray<IChecklistItem>;
  itinerary: Types.DocumentArray<IItineraryDay>;
  flightDetails: Types.DocumentArray<IFlightDetail>;
  accommodationDetails: Types.DocumentArray<IAccommodationDetail>;
  transportDetails: Types.DocumentArray<ITransportDetail>;
  packingList: Types.DocumentArray<IPackingCategory>;
  documents: Types.DocumentArray<IDocumentDetail>;
  
  importantContacts: {
    emergencyContact: { name: string; phone: string; relation: string; email?: string; };
    travelInsurance: { provider: string; policyNo: string; phone: string; coverage: string; };
    hotelContact: { name: string; phone: string; address: string; };
    localEmbassy: { country: string; address: string; phone: string; email: string; workingHours: string; };
    localEmergency: { police: string; ambulance: string; fire: string; };
  };
  
  notes: string;
  travelGoals: string[];
  
  planningProgress: {
    overall: number;
    checklist: number;
    packing: number;
    bookings: number;
    documents: number;
  };
  
  createdAt: Date;
  updatedAt: Date;

  // Virtuals definitions for TypeScript
  estimatedTotalBudget: number;
  budgetUtilization: number;
  totalDays: number;
  bookedFlights: number;
  essentialDocumentsVerified: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const CoordinatesSchema = new Schema<ICoordinates>({
  lat: { type: Number, min: -90, max: 90 },
  lng: { type: Number, min: -180, max: 180 },
}, { _id: false });

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const TravelPlanSchema = new Schema<ITravelPlan>(
  {
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'tripId is required'],
      unique: true,
      index: true,
    },
    purpose: { type: String, default: '', maxlength: 500 },
    travelStyle: {
      type: String,
      enum: ['budget', 'comfort', 'luxury', 'backpacking', 'business'],
      default: 'comfort',
    },
    groupSize: { type: Number, default: 1, min: 1 },
    
    budgetOverview: {
      total: { type: Number, default: 0, min: 0 },
      flights: { type: Number, default: 0, min: 0 },
      accommodation: { type: Number, default: 0, min: 0 },
      transport: { type: Number, default: 0, min: 0 },
      food: { type: Number, default: 0, min: 0 },
      activities: { type: Number, default: 0, min: 0 },
      shopping: { type: Number, default: 0, min: 0 },
      miscellaneous: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD', uppercase: true, length: 3 },
      spent: { type: Number, default: 0, min: 0 },
      remaining: { type: Number, default: 0 },
    },
    
    checklist: [{
      item: { type: String, required: true, trim: true, maxlength: 200 },
      checked: { type: Boolean, default: false },
      dueDate: { type: Date },
      assignedTo: { type: String },
      priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
      category: { type: String, enum: ['before-trip', 'during-trip', 'after-trip'], default: 'before-trip' },
    }],
    
    itinerary: [{
      date: { type: Date, default: null },
      day: { type: String, default: '' },
      destination: { type: String, default: '' },
      stopId: { type: Schema.Types.ObjectId, ref: 'Stop' },
      location: { type: CoordinatesSchema, default: null },
      weather: { condition: String, temperature: Number, icon: String },
      activities: [{
        time: String,
        activity: { type: String, required: true },
        location: String,
        cost: { type: Number, min: 0 },
        currency: { type: String, uppercase: true, length: 3 },
        notes: String,
      }],
      transport: { type: String, default: '' },
      accommodation: { type: String, default: '' },
      meals: { breakfast: String, lunch: String, dinner: String },
      notes: { type: String, default: '' },
    }],
    
    flightDetails: [{
      type: { type: String, enum: ['departure', 'return', 'connecting'], required: true },
      airline: { type: String, default: '' },
      flightNo: { type: String, default: '' },
      from: { type: String, default: '' },
      to: { type: String, default: '' },
      fromLocation: { type: CoordinatesSchema, default: null },
      toLocation: { type: CoordinatesSchema, default: null },
      date: { type: Date, default: null },
      time: { type: String, default: '' },
      duration: String,
      terminal: String,
      gate: String,
      bookingRef: String,
      cost: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD', uppercase: true, length: 3 },
      status: { type: String, enum: ['confirmed', 'pending', 'cancelled'], default: 'pending' },
    }],
    
    accommodationDetails: [{
      stopId: { type: Schema.Types.ObjectId, ref: 'Stop' },
      hotelName: { type: String, default: '' },
      address: { type: String, default: '' },
      location: { type: CoordinatesSchema, default: null },
      checkIn: { type: Date, default: null },
      checkOut: {
        type: Date,
        default: null,
        validate: {
          validator: function(this: any, value: Date) {
            if (!this.checkIn || !value) return true;
            return value >= this.checkIn;
          },
          message: 'Check-out date must be after or equal to check-in date.',
        },
      },
      confirmationNo: { type: String, default: '' },
      contact: { type: String, default: '' },
      cost: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD', uppercase: true, length: 3 },
      amenities: [{ type: String }],
      rating: { type: Number, min: 1, max: 5 },
      notes: { type: String, default: '' },
    }],
    
    transportDetails: [{
      type: { type: String, enum: ['train', 'bus', 'taxi', 'ferry', 'cab', 'car rental', 'other'], required: true },
      operator: { type: String, default: '' },
      pnr: { type: String, default: '' },
      from: { type: String, default: '' },
      to: { type: String, default: '' },
      fromLocation: { type: CoordinatesSchema, default: null },
      toLocation: { type: CoordinatesSchema, default: null },
      date: { type: Date, default: null },
      time: { type: String, default: '' },
      duration: String,
      cost: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD', uppercase: true, length: 3 },
      bookingRef: String,
      notes: { type: String, default: '' },
    }],
    
    packingList: [{
      category: { type: String, required: true, trim: true },
      icon: String,
      items: [{
        name: { type: String, required: true, trim: true },
        checked: { type: Boolean, default: false },
        quantity: { type: Number, default: 1, min: 1 },
        priority: { type: String, enum: ['essential', 'recommended', 'optional'], default: 'recommended' },
      }],
    }],
    
    documents: [{
      name: { type: String, required: true },
      type: { type: String, enum: ['passport', 'visa', 'insurance', 'ticket', 'reservation', 'vaccination', 'other'], required: true },
      fileUrl: String,
      documentNumber: String,
      issueDate: Date,
      expiryDate: Date,
      issuingCountry: { type: String, uppercase: true, length: 3 },
      notes: String,
      verified: { type: Boolean, default: false },
    }],
    
    importantContacts: {
      emergencyContact: { name: { type: String, default: '' }, phone: { type: String, default: '' }, relation: { type: String, default: '' }, email: String },
      travelInsurance: { provider: { type: String, default: '' }, policyNo: { type: String, default: '' }, phone: { type: String, default: '' }, coverage: { type: String, default: '' } },
      hotelContact: { name: { type: String, default: '' }, phone: { type: String, default: '' }, address: { type: String, default: '' } },
      localEmbassy: { country: { type: String, default: '' }, address: { type: String, default: '' }, phone: { type: String, default: '' }, email: { type: String, default: '' }, workingHours: { type: String, default: '' } },
      localEmergency: { police: { type: String, default: '' }, ambulance: { type: String, default: '' }, fire: { type: String, default: '' } },
    },
    
    notes: { type: String, default: '', maxlength: 5000 },
    travelGoals: [{ type: String, maxlength: 200 }],
    
    planningProgress: {
      overall: { type: Number, default: 0, min: 0, max: 100 },
      checklist: { type: Number, default: 0, min: 0, max: 100 },
      packing: { type: Number, default: 0, min: 0, max: 100 },
      bookings: { type: Number, default: 0, min: 0, max: 100 },
      documents: { type: Number, default: 0, min: 0, max: 100 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS & HOOKS
// ─────────────────────────────────────────────────────────────────────────────

TravelPlanSchema.virtual('estimatedTotalBudget').get(function() {
  const b = this.budgetOverview;
  return b.flights + b.accommodation + b.transport + b.food + b.activities + b.shopping + b.miscellaneous;
});

TravelPlanSchema.virtual('budgetUtilization').get(function() {
  const total = this.budgetOverview.total || (this as any).estimatedTotalBudget;
  if (total === 0) return 0;
  return Math.round((this.budgetOverview.spent / total) * 100);
});

TravelPlanSchema.virtual('totalDays').get(function() { return this.itinerary.length; });
TravelPlanSchema.virtual('bookedFlights').get(function() { return this.flightDetails.filter(f => f.status === 'confirmed').length; });
TravelPlanSchema.virtual('essentialDocumentsVerified').get(function() {
  const essentialDocs = this.documents.filter(d => ['passport', 'visa', 'insurance'].includes(d.type));
  return essentialDocs.length > 0 && essentialDocs.every(d => d.verified);
});

TravelPlanSchema.pre('save', function(next) {
  // Checklist
  const checklistTotal = this.checklist.length;
  const checklistDone = this.checklist.filter(item => item.checked).length;
  this.planningProgress.checklist = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  // Packing
  let packingTotal = 0; let packingDone = 0;
  this.packingList.forEach(cat => {
    packingTotal += cat.items.length;
    packingDone += cat.items.filter(item => item.checked).length;
  });
  this.planningProgress.packing = packingTotal > 0 ? Math.round((packingDone / packingTotal) * 100) : 0;

  // Bookings
  const bookingChecks = [
    this.flightDetails.some(f => f.status === 'confirmed'),
    this.accommodationDetails.length > 0,
    this.transportDetails.length > 0,
  ].filter(Boolean).length;
  this.planningProgress.bookings = Math.round((bookingChecks / 3) * 100);

  // Documents
  const docTotal = this.documents.length;
  const docVerified = this.documents.filter(d => d.verified).length;
  this.planningProgress.documents = docTotal > 0 ? Math.round((docVerified / docTotal) * 100) : 0;

  // Overall
  this.planningProgress.overall = Math.round(
    (this.planningProgress.checklist + this.planningProgress.packing + 
     this.planningProgress.bookings + this.planningProgress.documents) / 4
  );

  this.budgetOverview.remaining = this.budgetOverview.total - this.budgetOverview.spent;

  // Auto-sync budget
  if (this.budgetOverview.total === 0) {
    const estimated = (this as any).estimatedTotalBudget;
    if (estimated > 0) this.budgetOverview.total = estimated;
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────
TravelPlanSchema.index({ tripId: 1 });
TravelPlanSchema.index({ 'itinerary.date': 1 });
TravelPlanSchema.index({ 'flightDetails.date': 1, 'flightDetails.status': 1 });
TravelPlanSchema.index({ 'documents.expiryDate': 1 });
TravelPlanSchema.index({ 'checklist.assignedTo': 1, 'checklist.checked': 1 });

export const TravelPlan = model<ITravelPlan>('TravelPlan', TravelPlanSchema);