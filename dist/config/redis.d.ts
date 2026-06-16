import Redis from 'ioredis';
export declare class RedisClient {
    private static instance;
    client: Redis;
    subscriber: Redis;
    publisher: Redis;
    private constructor();
    static getInstance(): RedisClient;
    private setupEventHandlers;
    connect(): Promise<void>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<void>;
    disconnect(): Promise<void>;
    healthCheck(): Promise<boolean>;
}
export declare const redisClient: RedisClient;
//# sourceMappingURL=redis.d.ts.map