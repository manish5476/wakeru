import { Types } from 'mongoose';
import { Expense } from '../expense/expense.model';
import { Trip } from '../trips/trip.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';

export const personService = {
    /**
     * Get complete relationship between two users.
     * All shared expenses, trips, and balance.
     */
    async getPersonDetail(currentUserId: string, personUserId: string) {
        // Get person info
        const person = await User.findById(personUserId)
            .select('displayName photoURL email bankingDetails.upiId stats')
            .lean();

        if (!person) throw new AppError('User not found', 404);

        // Find all shared expenses
        const sharedExpenses = await Expense.find({
            $and: [
                // Current user is involved
                { $or: [{ paidBy: currentUserId }, { 'splits.userId': currentUserId }] },
                // Person is involved
                { $or: [{ paidBy: personUserId }, { 'splits.userId': personUserId }] },
            ],
        })
            .select('title amountBase amountLocal localCurrency baseCurrency date category paidBy paidByName splits tripId isSettled')
            .sort({ date: -1 })
            .lean();

        // Calculate balances
        let youOwe = 0;
        let theyOwe = 0;
        const tripIds = new Set<string>();

        sharedExpenses.forEach((exp: any) => {
            tripIds.add(exp.tripId?.toString());

            // Person paid, you owe them
            if (exp.paidBy === personUserId) {
                const mySplit = exp.splits?.find((s: any) => s.userId === currentUserId);
                if (mySplit && !mySplit.isPaid) {
                    youOwe += mySplit.amountBase;
                }
            }

            // You paid, they owe you
            if (exp.paidBy === currentUserId) {
                const theirSplit = exp.splits?.find((s: any) => s.userId === personUserId);
                if (theirSplit && !theirSplit.isPaid) {
                    theyOwe += theirSplit.amountBase;
                }
            }
        });

        // Get shared trips
        const trips = await Trip.find({
            _id: { $in: Array.from(tripIds) },
        })
            .select('title startDate endDate baseCurrency members stops totalSpentBase status')
            .lean();

        // Calculate per-trip breakdown
        const tripBreakdown = trips.map((trip: any) => {
            const tripExpenses = sharedExpenses.filter(
                (e: any) => e.tripId?.toString() === trip._id.toString()
            );

            let tripYouPaid = 0;
            let tripPersonPaid = 0;

            tripExpenses.forEach((exp: any) => {
                if (exp.paidBy === currentUserId) tripYouPaid += exp.amountBase;
                if (exp.paidBy === personUserId) tripPersonPaid += exp.amountBase;
            });

            return {
                tripId: trip._id,
                title: trip.title,
                startDate: trip.startDate,
                endDate: trip.endDate,
                baseCurrency: trip.baseCurrency,
                status: trip.status,
                totalSpent: trip.totalSpentBase,
                youPaid: parseFloat(tripYouPaid.toFixed(2)),
                personPaid: parseFloat(tripPersonPaid.toFixed(2)),
                netInTrip: parseFloat((tripPersonPaid - tripYouPaid).toFixed(2)), // Positive = you owe in this trip
                expenseCount: tripExpenses.length,
            };
        });

        return {
            person: {
                userId: personUserId,
                displayName: (person as any).displayName,
                photoURL: (person as any).photoURL,
                email: (person as any).email,
                upiId: (person as any).bankingDetails?.upiId,
                totalTrips: (person as any).stats?.totalGroups || tripIds.size,
            },
            balance: {
                youOwe: parseFloat(youOwe.toFixed(2)),
                theyOwe: parseFloat(theyOwe.toFixed(2)),
                netBalance: parseFloat((theyOwe - youOwe).toFixed(2)),
            },
            sharedTrips: tripBreakdown,
            sharedExpenses: sharedExpenses.map((e: any) => ({
                _id: e._id,
                title: e.title,
                amountBase: e.amountBase,
                amountLocal: e.amountLocal,
                localCurrency: e.localCurrency,
                baseCurrency: e.baseCurrency,
                date: e.date,
                category: e.category,
                paidBy: e.paidBy,
                paidByName: e.paidByName,
                isSettled: e.isSettled,
                tripId: e.tripId,
                direction: e.paidBy === currentUserId ? 'you_paid' : 'they_paid',
            })),
            summary: {
                totalSharedExpenses: sharedExpenses.length,
                totalSharedTrips: tripIds.size,
                settledCount: sharedExpenses.filter((e: any) => e.isSettled).length,
                pendingCount: sharedExpenses.filter((e: any) => !e.isSettled).length,
            },
        };
    },
};