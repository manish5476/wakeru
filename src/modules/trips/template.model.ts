import { Schema, model, Document } from 'mongoose';

export interface ITripTemplate extends Document {
    title: string;
    description: string;
    category: string;           // beach, mountain, city, roadtrip, pilgrimage, business
    destination: string;
    country: string;
    durationDays: number;
    estimatedBudget: number;
    baseCurrency: string;
    stops: {
        name: string;
        emoji: string;
        country: string;
        currency: string;
        estimatedCost: number;
        days: number;
        notes: string;
        suggestedCategories: string[];
    }[];
    tags: string[];
    popularity: number;         // Download count
    rating: number;             // Average rating
    createdBy: string;          // Firebase UID
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const templateSchema = new Schema<ITripTemplate>(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        category: {
            type: String,
            enum: ['beach', 'mountain', 'city', 'roadtrip', 'pilgrimage', 'business', 'adventure', 'luxury', 'budget'],
            required: true,
        },
        destination: { type: String, required: true },
        country: { type: String, required: true },
        durationDays: { type: Number, required: true },
        estimatedBudget: { type: Number, required: true },
        baseCurrency: { type: String, default: 'INR' },
        stops: [{
            name: String,
            emoji: String,
            country: String,
            currency: String,
            estimatedCost: Number,
            days: Number,
            notes: String,
            suggestedCategories: [String],
        }],
        tags: [{ type: String }],
        popularity: { type: Number, default: 0 },
        rating: { type: Number, default: 0 },
        createdBy: { type: String, required: true },
        isPublic: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false }
);

templateSchema.index({ isPublic: 1, popularity: -1 });
templateSchema.index({ category: 1, isPublic: 1 });
templateSchema.index({ tags: 1 });

export const TripTemplate = model<ITripTemplate>('TripTemplate', templateSchema);