interface OCRResult {
    success: boolean;
    confidence: number;
    rawText?: string;
    extractedItems?: Array<{
        name: string;
        category: string;
        price: number;
        quantity: number;
        confidence: number;
    }>;
    merchantName?: string;
    merchantAddress?: string;
    date?: Date;
    totalAmount?: number;
    taxAmount?: number;
    currency?: string;
    paymentMethod?: string;
    error?: string;
}
export declare class OCRProcessor {
    /**
     * Process receipt image with AI OCR
     */
    processReceipt(receiptId: string, imagePath: string): Promise<OCRResult>;
    /**
     * Preprocess image for better OCR accuracy
     */
    private preprocessImage;
    /**
     * Process with Google Vision API
     */
    private processWithGoogleVision;
    /**
     * Process with AWS Textract
     */
    private processWithAWSTextract;
    /**
     * Process with Tesseract.js (fallback)
     */
    private processWithTesseract;
    /**
     * Post-process OCR results with AI/ML
     */
    private postProcessResults;
    /**
     * Extract merchant name from OCR text
     */
    private extractMerchantName;
    /**
     * Extract date from OCR text
     */
    private extractDate;
    /**
     * Extract total amount from OCR text
     */
    private extractTotalAmount;
    /**
     * Extract tax amount
     */
    private extractTaxAmount;
    /**
     * Extract line items from receipt
     */
    private extractLineItems;
    /**
     * Extract currency from receipt
     */
    private extractCurrency;
    /**
     * Categorize items using semantic analysis
     */
    private categorizeItems;
}
export declare const ocrProcessor: OCRProcessor;
export {};
//# sourceMappingURL=ocr.processor.d.ts.map