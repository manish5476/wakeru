// ============================================================
// Analytics Types
// ============================================================

export interface AnalyticsFilters {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month' | 'year';
    category?: string;
    tripId?: string;
    stopId?: string;
    currency?: string;
    compareWith?: 'previous_period' | 'previous_year';
}

export interface QuickStats {
    thisMonth: { total: number; count: number };
    lastMonth: { total: number; count: number };
    thisWeek: { total: number; count: number };
    today: { total: number; count: number };
    spendingChange: number;        // % change vs last month
    weeklyChange: number;          // % change vs last week
    activeTrips: number;
    pendingSettlements: number;
    totalLent: number;
    totalOwed: number;
    netBalance: number;
    topCategory: { category: string; total: number } | null;
    topTrip: { tripId: string; tripTitle: string; total: number } | null;
    recentExpenses: RecentExpense[];
    spendingTrend: TrendPoint[];   // Last 7 days for sparkline
}

export interface RecentExpense {
    _id: string;
    title: string;
    amountBase: number;
    amountLocal: number;
    localCurrency: string;
    date: string;
    category: string;
    paidByName: string;
    tripTitle?: string;
}

export interface TrendPoint {
    date: string;
    amount: number;
    count: number;
}

export interface UserAnalytics {
    summary: {
        totalSpent: number;
        totalExpenses: number;
        averagePerExpense: number;
        averagePerDay: number;
        medianExpense: number;
        maxDailySpend: { date: string; amount: number };
        baseCurrency: string;
    };
    periodComparison?: {
        previousPeriod: { totalSpent: number; totalExpenses: number };
        changePercent: number;
        trend: 'up' | 'down' | 'stable';
    };
    highestExpense: ExpenseHighlight | null;
    lowestExpense: ExpenseHighlight | null;
    categories: CategoryBreakdown[];
    monthlySpending: MonthlyData[];
    dailySpending: DailyData[];
    weeklySpending: WeeklyData[];
    tripBreakdown: TripBreakdown[];
    dayOfWeekPattern: DayPattern[];
    hourOfDayPattern: HourPattern[];
    paymentMethodBreakdown?: PaymentBreakdown[];
    tags?: TagBreakdown[];
}

export interface ExpenseHighlight {
    _id: string;
    title: string;
    amountBase: number;
    amountLocal: number;
    currency: string;
    date: string;
    paidByName: string;
    tripTitle?: string;
    category: string;
}

export interface CategoryBreakdown {
    category: string;
    emoji: string;
    totalAmount: number;
    percentage: number;
    count: number;
    averagePerExpense: number;
    trend: 'up' | 'down' | 'stable';  // vs previous period
}

export interface MonthlyData {
    month: string;       // YYYY-MM
    monthName: string;   // Jan, Feb...
    totalAmount: number;
    count: number;
    categories: Record<string, number>;
}

export interface DailyData {
    date: string;        // YYYY-MM-DD
    totalAmount: number;
    count: number;
    dayOfWeek: string;
}

export interface WeeklyData {
    week: string;        // YYYY-Www
    startDate: string;
    endDate: string;
    totalAmount: number;
    count: number;
}

export interface TripBreakdown {
    tripId: string;
    tripTitle: string;
    totalAmount: number;
    percentage: number;
    count: number;
    startDate: string;
    endDate: string;
    status: string;
    memberCount: number;
}

export interface DayPattern {
    day: string;         // Sun, Mon...
    totalAmount: number;
    count: number;
    percentage: number;
}

export interface HourPattern {
    hour: number;        // 0-23
    totalAmount: number;
    count: number;
}

export interface PaymentBreakdown {
    method: string;      // cash, card, upi...
    totalAmount: number;
    count: number;
    percentage: number;
}

export interface TagBreakdown {
    tag: string;
    totalAmount: number;
    count: number;
}

export interface TripAnalytics {
    tripInfo: {
        tripId: string;
        title: string;
        baseCurrency: string;
        startDate: string;
        endDate: string;
        duration: number;
        status: string;
        memberCount: number;
        stopCount: number;
        totalBudget?: number;
        budgetUtilization?: number;
    };
    summary: {
        totalSpent: number;
        totalExpenses: number;
        averagePerExpense: number;
        averagePerDay: number;
        averagePerPerson: number;
        medianExpense: number;
        maxDailySpend: { date: string; amount: number };
        baseCurrency: string;
    };
    settlement: {
        settledCount: number;
        settledAmount: number;
        unsettledCount: number;
        unsettledAmount: number;
        settlementRate: number;
        estimatedTransfers: number;
    };
    highestExpense: ExpenseHighlight | null;
    lowestExpense: ExpenseHighlight | null;
    categories: CategoryBreakdown[];
    dailySpending: DailyData[];
    memberSpending: MemberSpending[];
    stopBreakdown: StopBreakdown[];
    currencyBreakdown: CurrencyBreakdown[];
    dayOfWeekPattern: DayPattern[];
    spendingVelocity: VelocityData[];  // Cumulative spending over trip
    budgetTracking?: BudgetTracking[];
}

export interface MemberSpending {
    userId: string;
    displayName: string;
    photoURL?: string;
    totalPaid: number;
    totalOwed: number;
    netBalance: number;
    expenseCount: number;
    percentage: number;
    categories: Record<string, number>;
    topExpense?: ExpenseHighlight;
}

export interface StopBreakdown {
    stopId: string;
    stopName: string;
    emoji: string;
    currency: string;
    totalLocal: number;
    totalBase: number;
    count: number;
    percentage: number;
    budget?: number;
    budgetUtilization?: number;
    days: number;
    averagePerDay: number;
}

export interface CurrencyBreakdown {
    currency: string;
    totalLocal: number;
    totalBase: number;
    exchangeRate: number;
    count: number;
    percentage: number;
}

export interface VelocityData {
    date: string;
    dailyAmount: number;
    cumulativeAmount: number;
}

export interface BudgetTracking {
    stopId: string;
    stopName: string;
    budget: number;
    spent: number;
    remaining: number;
    utilization: number;
    status: 'under' | 'on_track' | 'over';
}

export interface YearlySummary {
    year: number;
    totalSpent: number;
    totalExpenses: number;
    averagePerMonth: number;
    highestMonth: MonthlyData;
    lowestMonth: MonthlyData;
    monthlyBreakdown: MonthlyData[];
    quarterlyBreakdown: QuarterlyData[];
    categories: CategoryBreakdown[];
    yearOverYear?: {
        previousYear: number;
        changePercent: number;
        trend: 'up' | 'down' | 'stable';
    };
}

export interface QuarterlyData {
    quarter: string;     // Q1, Q2, Q3, Q4
    totalAmount: number;
    count: number;
    months: number[];
}

// Category emoji mapping
export const CATEGORY_EMOJIS: Record<string, string> = {
    food: '🍽️',
    stay: '🏨',
    transport: '🚗',
    activity: '🎯',
    shopping: '🛍️',
    health: '💊',
    other: '📌',
};

export const CATEGORY_COLORS: Record<string, string> = {
    food: '#FF6B6B',
    stay: '#4ECDC4',
    transport: '#45B7D1',
    activity: '#96CEB4',
    shopping: '#FFEAA7',
    health: '#DDA0DD',
    other: '#98D8C8',
};