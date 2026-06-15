import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

export class RedisClient {
  private static instance: RedisClient;
  public client: Redis;
  public subscriber: Redis;
  public publisher: Redis;

  private constructor() {
    const redisOptions: Redis.RedisOptions = {
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
    this.client.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    this.client.on('error', (error) => {
      logger.error('❌ Redis connection error:', error);
    });

    this.client.on('ready', () => {
      logger.info('✅ Redis client ready');
    });

    this.client.on('reconnecting', () => {
      logger.warn('⚠️ Redis reconnecting...');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      await this.subscriber.connect();
      await this.publisher.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
    logger.info('Redis disconnected');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

export const redisClient = RedisClient.getInstance();