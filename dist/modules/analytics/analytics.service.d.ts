export declare class AnalyticsService {
    /**
     * Get comprehensive user analytics
     */
    getUserAnalytics(userId: string, timeframe?: 'week' | 'month' | 'year'): Promise<any>;
    /**
     * Get group analytics
     */
    getGroupAnalytics(groupId: string, userId: string, timeframe?: 'week' | 'month' | 'year'): Promise<any>;
    /**
     * Get predictive analytics
     */
    getPredictiveAnalytics(userId: string, groupId: string): Promise<any>;
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
     * Group insights
     */
    private getGroupInsights;
    /**
     * Group overview
     */
    private getGroupOverview;
    /**
     * Member contributions
     */
    private getMemberContributions;
    /**
     * Group category distribution
     */
    private getGroupCategoryDistribution;
    /**
     * Expense timeline
     */
    private getExpenseTimeline;
    /**
     * Group settlement status
     */
    private getGroupSettlementStatus;
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