import Redis, { RedisOptions } from 'ioredis';
import { config } from './index';
import { logger } from './logger';

export class RedisClient {
  private static instance: RedisClient;
  public client: Redis;
  public subscriber: Redis;
  public publisher: Redis;

  private constructor() {
    const redisOptions: RedisOptions = {
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error('Redis retry limit exceeded');
          return null;
        }
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    };

    if (config.REDIS_PASSWORD) {
      redisOptions.password = config.REDIS_PASSWORD;
    }

    this.client = new Redis(config.REDIS_URL, redisOptions);
    this.subscriber = new Redis(config.REDIS_URL, redisOptions);
    this.publisher = new Redis(config.REDIS_URL, redisOptions);

    this.setupEventHandlers();
  }

  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private setupEventHandlers(): void {
    // MODIFIED: Event handlers are disabled.
  }

  async connect(): Promise<void> {
    // MODIFIED: This function is disabled to allow the server to run without a database.
    logger.warn('Redis connection is disabled. The application will run without connecting to Redis.');
    return Promise.resolve();
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    return Promise.resolve();
  }

  async get(key: string): Promise<string | null> {
    return Promise.resolve(null);
  }

  async delete(key: string): Promise<void> {
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    // MODIFIED: This function is disabled.
    return Promise.resolve();
  }

  async healthCheck(): Promise<boolean> {
    // MODIFIED: Always return false as Redis is not connected.
    return false;
  }
}

export const redisClient = RedisClient.getInstance();