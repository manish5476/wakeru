export declare class ExchangeRateAPI {
    private static cache;
    private static baseUrl;
    static getRates(baseCurrency: string): Promise<any>;
    static convert(amount: number, from: string, to: string): Promise<number>;
}
//# sourceMappingURL=exchangeRate.api.d.ts.map