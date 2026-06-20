import { TripTemplate, ITripTemplate } from './template.model';
import { AppError } from '../../shared/errors/AppError';

export const templateService = {
    /**
     * Create a trip template from an existing trip.
     */
    async createFromTrip(tripId: string, userId: string, makePublic: boolean = false): Promise<ITripTemplate> {
        const Trip = require('./trip.model').Trip;
        const trip = await Trip.findById(tripId);
        if (!trip) throw new AppError('Trip not found', 404);
        if (!trip.isAdmin(userId)) throw new AppError('Only admins can create templates', 403);

        const template = new TripTemplate({
            title: trip.title,
            description: `${trip.stops.length} stops · ${trip.members.filter((m: any) => m.isActive).length} travelers · ${trip.baseCurrency} ${trip.totalSpentBase?.toLocaleString() || 0} spent`,
            category: 'city',
            destination: trip.stops[0]?.name || trip.title,
            country: trip.stops[0]?.country || 'IN',
            durationDays: Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000),
            estimatedBudget: trip.totalSpentBase || trip.totalBudget || 0,
            baseCurrency: trip.baseCurrency,
            stops: trip.stops.map((s: any) => ({
                name: s.name,
                emoji: s.emoji,
                country: s.country,
                currency: s.currency,
                estimatedCost: s.totalSpentBase || 0,
                days: s.startDate && s.endDate
                    ? Math.ceil((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 86400000)
                    : 1,
                notes: s.notes || '',
                suggestedCategories: ['food', 'stay', 'transport'],
            })),
            tags: [],
            popularity: 0,
            rating: 0,
            createdBy: userId,
            isPublic: makePublic,
        });

        await template.save();
        return template;
    },

    /**
     * Get public templates.
     */
    async getPublicTemplates(category?: string, search?: string, page: number = 1, limit: number = 10) {
        const query: any = { isPublic: true };
        if (category) query.category = category;
        if (search) {
            query.$or = [
                { title: new RegExp(search, 'i') },
                { destination: new RegExp(search, 'i') },
                { tags: new RegExp(search, 'i') },
            ];
        }

        const [templates, total] = await Promise.all([
            TripTemplate.find(query)
                .sort({ popularity: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            TripTemplate.countDocuments(query),
        ]);

        return { templates, total, page, limit };
    },

    /**
     * Get popular templates for homepage.
     */
    async getPopularTemplates(limit: number = 6): Promise<ITripTemplate[]> {
        return TripTemplate.find({ isPublic: true })
            .sort({ popularity: -1 })
            .limit(limit)
            .select('title description destination country durationDays estimatedBudget baseCurrency stops tags rating')
            .lean() as unknown as Promise<ITripTemplate[]>;
    },

    /**
     * Use a template to create a trip.
     */
    async useTemplate(templateId: string, userId: string, customizations?: any) {
        const template = await TripTemplate.findById(templateId);
        if (!template) throw new AppError('Template not found', 404);

        // Increment popularity
        await TripTemplate.findByIdAndUpdate(templateId, { $inc: { popularity: 1 } });

        // Return trip creation data
        return {
            title: template.title,
            description: template.description,
            baseCurrency: template.baseCurrency,
            totalBudget: template.estimatedBudget,
            startDate: new Date(),
            endDate: new Date(Date.now() + template.durationDays * 86400000),
            stops: template.stops.map((s, i) => ({
                name: s.name,
                emoji: s.emoji,
                country: s.country,
                currency: s.currency,
                currentExchangeRate: s.currency === template.baseCurrency ? 1.0 : undefined,
                budget: s.estimatedCost,
                order: i,
                notes: s.notes,
                startDate: new Date(Date.now() + i * s.days * 86400000),
                endDate: new Date(Date.now() + (i + 1) * s.days * 86400000),
            })),
        };
    },
};