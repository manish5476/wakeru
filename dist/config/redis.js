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
        // MODIFIED: Event handlers are disabled.
    }
    async connect() {
        // MODIFIED: This function is disabled to allow the server to run without a database.
        logger_1.logger.warn('Redis connection is disabled. The application will run without connecting to Redis.');
        return Promise.resolve();
    }
    async set(key, value, ttl) {
        return Promise.resolve();
    }
    async get(key) {
        return Promise.resolve(null);
    }
    async delete(key) {
        return Promise.resolve();
    }
    async disconnect() {
        // MODIFIED: This function is disabled.
        return Promise.resolve();
    }
    async healthCheck() {
        // MODIFIED: Always return false as Redis is not connected.
        return false;
    }
}
exports.RedisClient = RedisClient;
exports.redisClient = RedisClient.getInstance();
//# sourceMappingURL=redis.js.map