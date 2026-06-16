export declare class CurrencyUtils {
    private static cache;
    private static rates;
    /**
     * Get exchange rate between two currencies
     */
    static getExchangeRate(from: string, to: string): Promise<number>;
    /**
     * Convert amount from one currency to another
     */
    static convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number>;
    /**
     * Get currency symbol
     */
    static getCurrencySymbol(currency: string): string;
    /**
     * Format currency for display
     */
    static formatCurrency(amount: number, currency: string): string;
    /**
     * Bulk convert multiple amounts
     */
    static bulkConvert(amounts: Array<{
        amount: number;
        from: string;
        to: string;
    }>): Promise<number[]>;
    /**
     * Get all available currencies
     */
    static getAvailableCurrencies(): Array<{
        code: string;
        symbol: string;
        name: string;
    }>;
    /**
     * Validate currency code
     */
    static isValidCurrency(currency: string): boolean;
}
//# sourceMappingURL=currency.utils.d.ts.map