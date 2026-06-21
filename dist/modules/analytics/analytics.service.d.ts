import { AnalyticsFilters, QuickStats, UserAnalytics, TripAnalytics, YearlySummary } from './analytics.types';
export declare const analyticsService: {
    getQuickStats(userId: string): Promise<QuickStats>;
    getUserAnalytics(userId: string, filters?: AnalyticsFilters): Promise<UserAnalytics>;
    getTripAnalytics(tripId: string, userId: string, filters?: AnalyticsFilters): Promise<TripAnalytics>;
    getYearlySummary(userId: string, year: number): Promise<YearlySummary>;
};
//# sourceMappingURL=analytics.service.d.ts.map