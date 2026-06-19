export declare class AnalyticsService {
    /**
     * Get comprehensive user analytics
     */
    getUserAnalytics(userId: string, timeframe?: 'week' | 'month' | 'year'): Promise<any>;
    /**
     * Get trip analytics
     */
    getTripAnalytics(tripId: string, userId: string, timeframe?: 'week' | 'month' | 'year'): Promise<any>;
    /**
     * Get predictive analytics
     */
    getPredictiveAnalytics(userId: string, tripId: string): Promise<any>;
    /**
     * Consumption vs Payment analysis (WAKERU EXCLUSIVE)
     */
    private getConsumptionVsPayment;
    /**
     * Category breakdown
     */
    private getCategoryBreakdown;
    /**
     * Spending trends over time
     */
    private getSpendingTrends;
    /**
     * Settlement efficiency
     */
    private getSettlementEfficiency;
    /**
     * Trip insights
     */
    private getTripInsights;
    /**
     * Trip overview
     */
    private getTripOverview;
    /**
     * Member contributions
     */
    private getMemberContributions;
    /**
     * Trip category distribution
     */
    private getTripCategoryDistribution;
    /**
     * Expense timeline
     */
    private getExpenseTimeline;
    /**
     * Trip settlement status
     */
    private getTripSettlementStatus;
    /**
     * Calculate predictions using linear regression
     */
    private calculatePredictions;
    /**
     * Get timeframe filter
     */
    private getTimeframeFilter;
}
export declare const analyticsService: AnalyticsService;
//# sourceMappingURL=analytics.service.d.ts.map