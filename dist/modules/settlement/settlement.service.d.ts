export declare class SettlementService {
    /**
     * Get simplified debts for a group
     */
    getSimplifiedDebts(groupId: string, userId: string): Promise<any>;
    /**
     * Get debt summary for a user in a group
     */
    getDebtSummary(groupId: string, userId: string): Promise<any>;
    /**
     * Create a settlement
     */
    createSettlement(groupId: string, fromUser: string, toUser: string, amount: number, paymentMethod: string, createdBy: string): Promise<any>;
    /**
     * Process payment for a settlement
     */
    processPayment(settlementId: string, paymentDetails: {
        transactionId: string;
        paymentGateway: string;
    }, userId: string): Promise<any>;
    /**
     * Cancel a settlement
     */
    cancelSettlement(settlementId: string, userId: string): Promise<any>;
    /**
     * Get settlement history for a group
     */
    getSettlementHistory(groupId: string, userId: string, options?: any): Promise<any>;
    /**
     * Update member balances in group
     */
    private updateMemberBalances;
    /**
     * Update related expense splits
     */
    private updateRelatedExpenses;
}
export declare const settlementService: SettlementService;
//# sourceMappingURL=settlement.service.d.ts.map