export declare class ReceiptService {
    /**
     * Upload and process receipt
     */
    uploadReceipt(userId: string, file: Express.Multer.File, groupId?: string, expenseId?: string): Promise<any>;
    /**
     * Get receipt by ID
     */
    getReceipt(receiptId: string, userId: string): Promise<any>;
    /**
     * Get user's receipts
     */
    getUserReceipts(userId: string, options?: {
        page?: number;
        limit?: number;
        status?: string;
    }): Promise<any>;
    /**
     * Get group receipts
     */
    getGroupReceipts(groupId: string, userId: string, options?: any): Promise<any>;
    /**
     * Update receipt with manual corrections
     */
    updateReceipt(receiptId: string, userId: string, updateData: any): Promise<any>;
    /**
     * Delete receipt
     */
    deleteReceipt(receiptId: string, userId: string): Promise<void>;
    /**
     * Reprocess receipt OCR
     */
    reprocessReceipt(receiptId: string, userId: string): Promise<any>;
    /**
     * Process receipt asynchronously
     */
    private processReceiptAsync;
    /**
     * Validate uploaded file
     */
    private validateFile;
    /**
     * Convert receipt to expense
     */
    convertToExpense(receiptId: string, userId: string, groupId: string): Promise<any>;
}
export declare const receiptService: ReceiptService;
//# sourceMappingURL=receipt.service.d.ts.map