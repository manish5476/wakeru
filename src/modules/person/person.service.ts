import { Types } from 'mongoose';
import { Expense } from '../expense/expense.model';
import { Trip } from '../trips/trip.model';
import { Friendship, FriendRequest } from '../friends/friends.model';
import { User } from '../auth/auth.model';
import { AppError } from '../../shared/errors/AppError';

// ============================================================
// SHARED HELPERS
// ============================================================

const getUserById = async (userId: string, selectFields: string) => {
    // ✅ FIX: Query by _id (UUID), not firebaseUid
    const user = await User.findOne({
        _id: userId,           // ← Query by Mongo _id (UUID)
        isActive: true,
        isDeleted: false,
    }).select(selectFields).lean();

    if (!user) throw new AppError('User not found', 404);
    return user;
};

const getSharedExpenseFilter = (userId1: string, userId2: string, extraFilters: any = {}) => {
    const baseFilter: any = {
        isArchived: false,
        ...extraFilters,
    };

    if (userId1 === userId2) {
        // Self view: all expenses where user is involved
        baseFilter.$or = [
            { paidBy: userId1 },
            { 'splits.userId': userId1 },
        ];
    } else {
        // Friend view: expenses where BOTH are involved
        baseFilter.$and = [
            { $or: [{ paidBy: userId1 }, { 'splits.userId': userId1 }] },
            { $or: [{ paidBy: userId2 }, { 'splits.userId': userId2 }] },
        ];
    }

    return baseFilter;
};

// ============================================================
// PERSON SERVICE (UUID Compatible)
// ============================================================

export const personService = {

    // ============================================================
    // 1. PROFILE
    // ============================================================

    async getPersonProfile(currentUserId: string, personUserId: string) {
        const isSelf = currentUserId === personUserId;

        const [person, friendshipInfo, balanceResult] = await Promise.all([
            getUserById(
                personUserId,
                'displayName photoURL email phoneNumber bankingDetails.upiId bio stats totalTrips createdAt'
            ),
            this._getFriendshipStatus(currentUserId, personUserId),
            this._getBalanceAggregate(currentUserId, personUserId),
        ]);

        const personData = person as any;

        // For self-view, get additional stats
        let extraStats = {};
        if (isSelf) {
            const [totalExpenses, activeTrips, completedTrips] = await Promise.all([
                Expense.countDocuments({
                    isArchived: false,
                    $or: [{ paidBy: currentUserId }, { 'splits.userId': currentUserId }],
                }),
                Trip.countDocuments({
                    'members.userId': currentUserId,
                    'members.isActive': true,
                    status: { $in: ['active', 'planning'] },
                    isArchived: false,
                }),
                Trip.countDocuments({
                    'members.userId': currentUserId,
                    'members.isActive': true,
                    status: 'completed',
                    isArchived: false,
                }),
            ]);
            extraStats = { totalExpenses, activeTrips, completedTrips, memberSince: personData.createdAt };
        }

        return {
            person: {
                userId: personUserId,
                displayName: personData.displayName || 'Unknown',
                photoURL: personData.photoURL,
                email: personData.email,
                phoneNumber: personData.phoneNumber,
                upiId: personData.bankingDetails?.upiId,
                bio: personData.bio,
                friendshipStatus: friendshipInfo.status,
                friendshipSince: friendshipInfo.since,
                totalSharedTrips: isSelf
                    ? (personData.totalTrips || 0)
                    : await Trip.countDocuments({
                        $and: [
                            { 'members.userId': currentUserId, 'members.isActive': true },
                            { 'members.userId': personUserId, 'members.isActive': true },
                        ],
                        isArchived: false,
                    }),
                isSelf,
                ...extraStats,
            },
            balance: {
                youOwe: balanceResult.youOwe,
                theyOwe: balanceResult.theyOwe,
                netBalance: balanceResult.theyOwe - balanceResult.youOwe,
                baseCurrency: balanceResult.baseCurrency || 'INR',
                pendingSettlementCount: balanceResult.pendingCount,
                fullySettled: balanceResult.pendingCount === 0,
            },
        };
    },

    // ============================================================
    // 2. SHARED EXPENSES (PAGINATED)
    // ============================================================

    async getSharedExpenses(
        currentUserId: string,
        personUserId: string,
        options: {
            page?: number; limit?: number; status?: string;
            category?: string; tripId?: string;
            sortBy?: string; sortOrder?: 'asc' | 'desc';
        } = {}
    ) {
        const { page = 1, limit = 20, status, category, tripId, sortBy = 'date', sortOrder = 'desc' } = options;

        const extraFilters: any = {};
        if (status === 'pending') extraFilters.isSettled = false;
        if (status === 'settled') extraFilters.isSettled = true;
        if (category) extraFilters.category = category;
        if (tripId) extraFilters.tripId = new Types.ObjectId(tripId);

        const filter = getSharedExpenseFilter(currentUserId, personUserId, extraFilters);
        const skip = (page - 1) * limit;

        const [total, expenses] = await Promise.all([
            Expense.countDocuments(filter),
            Expense.find(filter)
                .select('title amountBase amountLocal localCurrency baseCurrency date category paidBy paidByName splits tripId isSettled')
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const tripIds = [...new Set(expenses.map((e: any) => e.tripId?.toString()).filter(Boolean))];
        const trips = tripIds.length > 0
            ? await Trip.find({ _id: { $in: tripIds.map(id => new Types.ObjectId(id)) } })
                .select('title')
                .lean()
            : [];
        const tripMap = new Map(trips.map(t => [t._id.toString(), (t as any).title]));

        const isSelf = currentUserId === personUserId;

        const formattedExpenses = expenses.map((e: any) => {
            const yourSplit = e.splits?.find((s: any) => s.userId === currentUserId);
            const theirSplit = !isSelf
                ? e.splits?.find((s: any) => s.userId === personUserId)
                : undefined;

            return {
                _id: e._id.toString(),
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
                tripId: e.tripId?.toString(),
                tripName: e.tripId ? tripMap.get(e.tripId.toString()) : undefined,
                direction: isSelf
                    ? (e.paidBy === currentUserId ? 'you_paid' : 'you_owe')
                    : (e.paidBy === currentUserId ? 'you_paid' : 'they_paid'),
                yourShare: yourSplit ? Math.round(yourSplit.amountBase * 100) / 100 : undefined,
                theirShare: theirSplit ? Math.round(theirSplit.amountBase * 100) / 100 : undefined,
            };
        });

        return {
            expenses: formattedExpenses,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        };
    },

    // ============================================================
    // 3. SHARED TRIPS
    // ============================================================

    async getSharedTrips(
        currentUserId: string,
        personUserId: string,
        options: { page?: number; limit?: number } = {}
    ) {
        const { page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;
        const isSelf = currentUserId === personUserId;

        let tripFilter: any;
        if (isSelf) {
            tripFilter = {
                'members.userId': currentUserId,
                'members.isActive': true,
                isArchived: false,
            };
        } else {
            tripFilter = {
                $and: [
                    { 'members.userId': currentUserId, 'members.isActive': true },
                    { 'members.userId': personUserId, 'members.isActive': true },
                ],
                isArchived: false,
            };
        }

        const [total, trips] = await Promise.all([
            Trip.countDocuments(tripFilter),
            Trip.find(tripFilter)
                .select('title coverImage startDate endDate baseCurrency members totalSpentBase status stops')
                .sort({ startDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const tripBreakdown = await Promise.all(trips.map(async (trip: any) => {
            let tripExpenses: any[];

            if (isSelf) {
                tripExpenses = await Expense.aggregate([
                    {
                        $match: {
                            tripId: trip._id,
                            isArchived: false,
                            $or: [{ paidBy: currentUserId }, { 'splits.userId': currentUserId }],
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            youPaid: { $sum: { $cond: [{ $eq: ['$paidBy', currentUserId] }, '$amountBase', 0] } },
                            count: { $sum: 1 },
                        },
                    },
                ]);
            } else {
                tripExpenses = await Expense.aggregate([
                    {
                        $match: {
                            tripId: trip._id,
                            isArchived: false,
                            $and: [
                                { $or: [{ paidBy: currentUserId }, { 'splits.userId': currentUserId }] },
                                { $or: [{ paidBy: personUserId }, { 'splits.userId': personUserId }] },
                            ],
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            youPaid: { $sum: { $cond: [{ $eq: ['$paidBy', currentUserId] }, '$amountBase', 0] } },
                            personPaid: { $sum: { $cond: [{ $eq: ['$paidBy', personUserId] }, '$amountBase', 0] } },
                            count: { $sum: 1 },
                        },
                    },
                ]);
            }

            const agg = tripExpenses[0] || { youPaid: 0, personPaid: 0, count: 0 };
            const yourMember = trip.members?.find((m: any) => m.userId === currentUserId);
            const destination = trip.stops?.[0]?.name || trip.title;

            return {
                tripId: trip._id.toString(),
                title: trip.title,
                coverImage: trip.coverImage,
                destination,
                startDate: trip.startDate,
                endDate: trip.endDate,
                status: trip.status,
                baseCurrency: trip.baseCurrency,
                totalSpent: trip.totalSpentBase || 0,
                youPaid: Math.round(agg.youPaid * 100) / 100,
                personPaid: isSelf ? 0 : Math.round((agg as any).personPaid * 100) / 100,
                netInTrip: isSelf ? 0 : Math.round(((agg as any).personPaid - agg.youPaid) * 100) / 100,
                expenseCount: agg.count,
                yourRole: yourMember?.role || 'member',
                memberCount: trip.members?.filter((m: any) => m.isActive).length || 0,
            };
        }));

        return {
            trips: tripBreakdown,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
        };
    },

    // ============================================================
    // 4. RECENT ACTIVITY
    // ============================================================

    async getRecentActivity(currentUserId: string, personUserId: string, limit: number = 10) {
        const filter = getSharedExpenseFilter(currentUserId, personUserId);
        const isSelf = currentUserId === personUserId;

        const expenses = await Expense.find(filter)
            .select('title amountBase baseCurrency date paidBy paidByName isSettled tripId category')
            .sort({ date: -1 })
            .limit(limit)
            .lean();

        const tripIds = [...new Set(expenses.map((e: any) => e.tripId?.toString()).filter(Boolean))];
        const trips = tripIds.length > 0
            ? await Trip.find({ _id: { $in: tripIds.map(id => new Types.ObjectId(id)) } })
                .select('title')
                .lean()
            : [];
        const tripMap = new Map(trips.map(t => [t._id.toString(), (t as any).title]));

        return expenses.map((exp: any) => ({
            type: exp.isSettled ? 'expense_settled' as const : 'expense_added' as const,
            date: exp.date,
            description: isSelf
                ? `${exp.baseCurrency} ${exp.amountBase} — ${exp.title}`
                : exp.paidBy === currentUserId
                    ? `You paid ${exp.baseCurrency} ${exp.amountBase} for "${exp.title}"`
                    : `${exp.paidByName} paid ${exp.baseCurrency} ${exp.amountBase} for "${exp.title}"`,
            amount: exp.amountBase,
            category: exp.category,
            tripName: exp.tripId ? tripMap.get(exp.tripId.toString()) : undefined,
        }));
    },

    // ============================================================
    // 5. SETTLEMENT OPTIONS
    // ============================================================

    async getSettlementOptions(currentUserId: string, personUserId: string) {
        if (currentUserId === personUserId) {
            return {
                balance: { youOwe: 0, theyOwe: 0, netBalance: 0, baseCurrency: 'INR' },
                options: [],
            };
        }

        const [person, balanceResult] = await Promise.all([
            getUserById(personUserId, 'displayName bankingDetails.upiId'),
            this._getBalanceAggregate(currentUserId, personUserId),
        ]);

        const personData = person as any;
        const options: any[] = [];

        if (balanceResult.theyOwe > 0.01) {
            if (personData.bankingDetails?.upiId) {
                options.push({
                    type: 'upi',
                    label: `Request ₹${balanceResult.theyOwe.toFixed(0)} via UPI`,
                    action: 'request_upi',
                    data: { toUserId: personUserId, toName: personData.displayName, amount: balanceResult.theyOwe, currency: balanceResult.baseCurrency, upiId: personData.bankingDetails.upiId },
                });
            }
            options.push({
                type: 'remind',
                label: 'Send Payment Reminder',
                action: 'send_reminder',
                data: { toUserId: personUserId, toName: personData.displayName, amount: balanceResult.theyOwe, currency: balanceResult.baseCurrency },
            });
        }

        if (balanceResult.youOwe > 0.01) {
            if (personData.bankingDetails?.upiId) {
                options.push({
                    type: 'upi',
                    label: `Pay ₹${balanceResult.youOwe.toFixed(0)} via UPI`,
                    action: 'pay_upi',
                    data: { toUserId: personUserId, toName: personData.displayName, amount: balanceResult.youOwe, currency: balanceResult.baseCurrency, upiId: personData.bankingDetails.upiId },
                });
            }
            options.push({
                type: 'cash',
                label: 'Mark as Paid (Cash)',
                action: 'mark_paid_cash',
                data: { toUserId: personUserId, amount: balanceResult.youOwe, currency: balanceResult.baseCurrency },
            });
        }

        if (balanceResult.youOwe < 0.01 && balanceResult.theyOwe < 0.01) {
            options.push({ type: 'none', label: 'All Settled! 🎉', action: 'none', data: {} });
        }

        return {
            balance: {
                youOwe: balanceResult.youOwe,
                theyOwe: balanceResult.theyOwe,
                netBalance: balanceResult.theyOwe - balanceResult.youOwe,
                baseCurrency: balanceResult.baseCurrency || 'INR',
            },
            options,
        };
    },

    // ============================================================
    // 6. FULL DETAIL
    // ============================================================

    async getFullDetail(currentUserId: string, personUserId: string) {
        const isSelf = currentUserId === personUserId;

        const [profile, expenses, trips, activity, settlement] = await Promise.all([
            this.getPersonProfile(currentUserId, personUserId),
            this.getSharedExpenses(currentUserId, personUserId, { limit: 100 }),
            this.getSharedTrips(currentUserId, personUserId, { limit: 50 }),
            this.getRecentActivity(currentUserId, personUserId, 50),
            this.getSettlementOptions(currentUserId, personUserId),
        ]);

        const result: any = {
            profile: profile.person,
            balance: profile.balance,
            expenses: expenses.expenses,
            trips: trips.trips,
            recentActivity: activity,
            settlementOptions: settlement.options,
        };

        if (isSelf) {
            result.exportMetadata = {
                exportedAt: new Date().toISOString(),
                exportedBy: currentUserId,
                version: '1.0',
                totalExpenses: expenses.pagination.total,
                totalTrips: trips.pagination.total,
            };
        }

        return result;
    },

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    async _getFriendshipStatus(userId: string, otherId: string) {
        if (userId === otherId) {
            return { status: 'self' as const, since: undefined };
        }

        const [u1, u2] = [userId, otherId].sort();
        const friendship = await Friendship.findOne({ user1Id: u1, user2Id: u2 }).lean();

        if (friendship?.status === 'blocked') return { status: 'blocked' as const };
        if (friendship?.status === 'active') {
            return { status: 'friend' as const, since: (friendship as any).createdAt };
        }

        const pending = await FriendRequest.findOne({
            $or: [
                { fromUserId: userId, toUserId: otherId, status: 'pending' },
                { fromUserId: otherId, toUserId: userId, status: 'pending' },
            ],
        }).lean();

        if (pending) {
            return { status: pending.fromUserId === userId ? 'pending_sent' as const : 'pending_received' as const };
        }

        return { status: 'none' as const };
    },

    async _getBalanceAggregate(userId1: string, userId2: string) {
        if (userId1 === userId2) {
            return { youOwe: 0, theyOwe: 0, pendingCount: 0, baseCurrency: 'INR' };
        }

        const result = await Expense.aggregate([
            {
                $match: {
                    isArchived: false,
                    $and: [
                        { $or: [{ paidBy: userId1 }, { 'splits.userId': userId1 }] },
                        { $or: [{ paidBy: userId2 }, { 'splits.userId': userId2 }] },
                    ],
                },
            },
            {
                $group: {
                    _id: null,
                    youOwe: {
                        $sum: {
                            $cond: [{ $eq: ['$paidBy', userId2] }, {
                                $reduce: {
                                    input: { $filter: { input: '$splits', as: 's', cond: { $and: [{ $eq: ['$$s.userId', userId1] }, { $eq: ['$$s.isPaid', false] }] } } },
                                    initialValue: 0,
                                    in: { $add: ['$$value', '$$this.amountBase'] },
                                },
                            }, 0],
                        },
                    },
                    theyOwe: {
                        $sum: {
                            $cond: [{ $eq: ['$paidBy', userId1] }, {
                                $reduce: {
                                    input: { $filter: { input: '$splits', as: 's', cond: { $and: [{ $eq: ['$$s.userId', userId2] }, { $eq: ['$$s.isPaid', false] }] } } },
                                    initialValue: 0,
                                    in: { $add: ['$$value', '$$this.amountBase'] },
                                },
                            }, 0],
                        },
                    },
                    pendingCount: { $sum: { $cond: [{ $eq: ['$isSettled', false] }, 1, 0] } },
                    baseCurrency: { $first: '$baseCurrency' },
                },
            },
        ]);

        if (result.length === 0) return { youOwe: 0, theyOwe: 0, pendingCount: 0, baseCurrency: 'INR' };
        return {
            youOwe: Math.round(result[0].youOwe * 100) / 100,
            theyOwe: Math.round(result[0].theyOwe * 100) / 100,
            pendingCount: result[0].pendingCount,
            baseCurrency: result[0].baseCurrency || 'INR',
        };
    },
};
