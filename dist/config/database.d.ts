export declare class Database {
    private static instance;
    private retryCount;
    private maxRetries;
    private constructor();
    static getInstance(): Database;
    connect(): Promise<void>;
    private handleConnectionError;
    disconnect(): Promise<void>;
    healthCheck(): Promise<boolean>;
}
export declare const database: Database;
//# sourceMappingURL=database.d.ts.map