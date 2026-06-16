export declare class AnalyticsAggregator {
    /**
     * WAKERU EXCLUSIVE: Consumption vs Payment Analytics
     * Shows users their actual spending patterns, not just who paid
     */
    getUserConsumptionVsPayment(userId: string, timeframe: 'month' | 'year'): Promise<{
        consumptionBreakdown: any;
        paymentBreakdown: any;
        summary: any;
        analysis: string[];
    }>;
    private generateBehavioralInsights;
    /**
     * PREDICTIVE ANALYTICS: Forecast future expenses
     */
    getPredictiveAnalytics(userId: string, groupId: string): Promise<any>;
    private calculatePredictions;
    private getTimeframeFilter;
}
//# sourceMappingURL=analytics.aggregator.d.ts.map