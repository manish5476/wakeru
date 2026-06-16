"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = exports.RedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const index_1 = require("./index");
const logger_1 = require("./logger");
class RedisClient {
    constructor() {
        const redisOptions = {
            retryStrategy: (times) => {
                if (times > 10) {
                    logger_1.logger.error('Redis retry limit exceeded');
                    return null;
                }
                const delay = Math.min(times * 200, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
        };
        if (index_1.config.REDIS_PASSWORD) {
            redisOptions.password = index_1.config.REDIS_PASSWORD;
        }
        this.client = new ioredis_1.default(index_1.config.REDIS_URL, redisOptions);
        this.subscriber = new ioredis_1.default(index_1.config.REDIS_URL, redisOptions);
        this.publisher = new ioredis_1.default(index_1.config.REDIS_URL, redisOptions);
        this.setupEventHandlers();
    }
    static getInstance() {
        if (!RedisClient.instance) {
            RedisClient.instance = new RedisClient();
        }
        return RedisClient.instance;
    }
    setupEventHandlers() {
        this.client.on('connect', () => {
            logger_1.logger.info('✅ Redis connected successfully');
        });
        this.client.on('error', (error) => {
            logger_1.logger.error('❌ Redis connection error:', error);
        });
        this.client.on('ready', () => {
            logger_1.logger.info('✅ Redis client ready');
        });
        this.client.on('reconnecting', () => {
            logger_1.logger.warn('⚠️ Redis reconnecting...');
        });
    }
    async connect() {
        try {
            await this.client.connect();
            await this.subscriber.connect();
            await this.publisher.connect();
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    async set(key, value, ttl) {
        if (ttl) {
            await this.client.set(key, value, 'EX', ttl);
        }
        else {
            await this.client.set(key, value);
        }
    }
    async get(key) {
        return this.client.get(key);
    }
    async delete(key) {
        await this.client.del(key);
    }
    async disconnect() {
        await this.client.quit();
        await this.subscriber.quit();
        await this.publisher.quit();
        logger_1.logger.info('Redis disconnected');
    }
    async healthCheck() {
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        }
        catch {
            return false;
        }
    }
}
exports.RedisClient = RedisClient;
exports.redisClient = RedisClient.getInstance();
//# sourceMappingURL=redis.js.map