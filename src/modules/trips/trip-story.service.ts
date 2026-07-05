import { Trip, ITrip } from './trip.model';
import { Expense, IExpense } from '../expense/expense.model';
import { Stop, IStop } from './stop.model';
import { AppError } from '../../shared/errors/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface TripStory {
    title: string;
    coverImage: string;
    duration: string;
    stats: {
        totalSpent: number;
        totalExpenses: number;
        totalPhotos: number;
        countriesVisited: number;
        citiesVisited: number;
        distanceTraveled: number; // km
    };
    timeline: {
        date: Date;
        title: string;
        description: string;
        expenses: { category: string; amount: number }[];
        photos: string[];
        location?: { lat: number; lng: number; name: string };
    }[];
    topMoments: {
        title: string;
        description: string;
        photo?: string;
        expense?: { amount: number; category: string };
    }[];
    memberHighlights: {
        userId: string;
        displayName: string;
        photoURL: string;
        role: string;
        funFact: string;
        totalPaid: number;
        favoriteCategory: string;
    }[];
    playlist: { song: string; artist: string; memory: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVICE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const generateTripStory = async (tripId: string): Promise<TripStory> => {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) throw new AppError('Trip not found', 404);

    const expenses = await Expense.find({ tripId, isArchived: false }).sort({ date: 1 }).lean();
    const stops = await Stop.find({ tripId }).sort({ order: 1 }).lean();

    return {
        title: `${trip.title} — The Story`,
        coverImage: trip.coverImage || '',
        duration: calculateDuration(trip.startDate, trip.endDate),
        stats: calculateStats(expenses as unknown as IExpense[], stops as unknown as IStop[]),
        timeline: generateTimeline(expenses as unknown as IExpense[], stops as unknown as IStop[]),
        topMoments: generateTopMoments(expenses as unknown as IExpense[]),
        memberHighlights: generateMemberHighlights(expenses as unknown as IExpense[], trip as unknown as ITrip),
        playlist: [
            { song: 'Mountain Melodies', artist: 'Local Band', memory: 'That long drive' },
            { song: 'Sunset Vibes', artist: 'Chill Wave', memory: 'Evening at the beach' }
        ],
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function calculateDuration(start: Date, end: Date): string {
    if (!start || !end) return 'A few days';
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
}

function calculateStats(expenses: IExpense[], stops: IStop[]) {
    let totalPhotos = 0;
    expenses.forEach(e => {
        if (e.attachments) totalPhotos += e.attachments.length;
        if (e.receiptImages) totalPhotos += e.receiptImages.length;
    });

    const uniqueCountries = new Set(stops.map(s => s.country).filter(Boolean));
    const uniqueCities = new Set(stops.map(s => s.name).filter(Boolean));

    return {
        totalSpent: expenses.reduce((sum, e) => sum + e.amountBase, 0),
        totalExpenses: expenses.length,
        totalPhotos,
        countriesVisited: uniqueCountries.size,
        citiesVisited: uniqueCities.size,
        distanceTraveled: stops.length * 100, // Dummy distance
    };
}

function generateTimeline(expenses: IExpense[], stops: IStop[]) {
    const timeline: TripStory['timeline'] = [];
    
    // Group expenses by date
    const dateMap = new Map<string, IExpense[]>();
    expenses.forEach(e => {
        const dateStr = new Date(e.date).toISOString().split('T')[0];
        if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
        dateMap.get(dateStr)!.push(e);
    });

    // Create a timeline entry for each active date
    const sortedDates = Array.from(dateMap.keys()).sort();
    
    sortedDates.forEach((dateStr, index) => {
        const dayExpenses = dateMap.get(dateStr)!;
        let dayTotal = 0;
        const photos: string[] = [];
        
        dayExpenses.forEach(e => {
            dayTotal += e.amountBase;
            if (e.attachments) {
                e.attachments.forEach(a => { if (a.type === 'image') photos.push(a.url); });
            }
            if (e.receiptImages) {
                photos.push(...e.receiptImages);
            }
        });

        // Try to match with a stop
        const dDate = new Date(dateStr);
        const stop = stops.find(s => s.startDate && s.endDate && dDate >= s.startDate && dDate <= s.endDate) || stops[0];

        timeline.push({
            date: dDate,
            title: stop ? `Exploring ${stop.name}` : `Day ${index + 1}`,
            description: `Spent ${dayTotal} on ${dayExpenses.length} things.`,
            expenses: dayExpenses.slice(0, 3).map(e => ({ category: e.category, amount: e.amountBase })),
            photos,
            location: stop?.location ? { lat: stop.location.lat, lng: stop.location.lng, name: stop.name } : undefined,
        });
    });

    return timeline;
}

function generateTopMoments(expenses: IExpense[]) {
    if (expenses.length === 0) return [];

    // Biggest expense
    const sorted = [...expenses].sort((a, b) => b.amountBase - a.amountBase);
    const topExpense = sorted[0];

    const photos: string[] = [];
    if (topExpense.attachments) {
        topExpense.attachments.forEach(a => { if (a.type === 'image') photos.push(a.url); });
    }
    if (topExpense.receiptImages) {
        photos.push(...topExpense.receiptImages);
    }

    return [
        {
            title: 'Biggest Splurge',
            description: topExpense.title,
            photo: photos.length > 0 ? photos[0] : undefined,
            expense: { amount: topExpense.amountBase, category: topExpense.category }
        }
    ];
}

function generateMemberHighlights(expenses: IExpense[], trip: ITrip) {
    if (trip.members.length === 0) return [];
    
    const catMapByMember = new Map<string, Map<string, number>>();
    
    expenses.forEach(e => {
        if (!catMapByMember.has(e.paidBy)) catMapByMember.set(e.paidBy, new Map());
        const uMap = catMapByMember.get(e.paidBy)!;
        uMap.set(e.category, (uMap.get(e.category) || 0) + e.amountBase);
    });

    return trip.members.map(m => {
        const uMap = catMapByMember.get(m.userId);
        let favCat = 'none';
        if (uMap) {
            let max = 0;
            for (const [cat, amt] of uMap.entries()) {
                if (amt > max) { max = amt; favCat = cat; }
            }
        }

        return {
            userId: m.userId,
            displayName: m.displayName,
            photoURL: m.photoURL || '',
            role: m.role,
            funFact: m.totalPaidBase > 5000 ? 'Big Spender' : 'Budget Saver',
            totalPaid: m.totalPaidBase || 0,
            favoriteCategory: favCat,
        };
    });
}
