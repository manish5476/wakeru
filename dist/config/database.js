"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.database = exports.Database = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const index_1 = require("./index");
const logger_1 = require("./logger");
class Database {
    constructor() {
        this.retryCount = 0;
        this.maxRetries = 5;
    }
    static getInstance() {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }
    async connect() {
        try {
            const options = {
                maxPoolSize: 10,
                minPoolSize: 2,
                socketTimeoutMS: 45000,
                serverSelectionTimeoutMS: 5000,
                heartbeatFrequencyMS: 10000,
                retryWrites: true,
                w: 'majority',
            };
            mongoose_1.default.connection.on('connected', () => {
                logger_1.logger.info('✅ MongoDB connected successfully');
                this.retryCount = 0;
            });
            mongoose_1.default.connection.on('error', (error) => {
                logger_1.logger.error('❌ MongoDB connection error:', error);
                this.handleConnectionError();
            });
            mongoose_1.default.connection.on('disconnected', () => {
                logger_1.logger.warn('⚠️ MongoDB disconnected');
                this.handleConnectionError();
            });
            // Graceful shutdown
            process.on('SIGINT', async () => {
                await mongoose_1.default.connection.close();
                logger_1.logger.info('MongoDB connection closed due to app termination');
                process.exit(0);
            });
            await mongoose_1.default.connect(index_1.config.MONGODB_URI, options);
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to MongoDB:', error);
            this.handleConnectionError();
        }
    }
    handleConnectionError() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
            logger_1.logger.info(`Retrying connection in ${delay}ms... (Attempt ${this.retryCount}/${this.maxRetries})`);
            setTimeout(() => {
                this.connect();
            }, delay);
        }
        else {
            logger_1.logger.error('Max retries reached. Exiting application.');
            process.exit(1);
        }
    }
    async disconnect() {
        await mongoose_1.default.disconnect();
        logger_1.logger.info('MongoDB disconnected');
    }
    async healthCheck() {
        try {
            const state = mongoose_1.default.connection.readyState;
            return state === 1; // 1 = connected
        }
        catch {
            return false;
        }
    }
}
exports.Database = Database;
exports.database = Database.getInstance();
//# sourceMappingURL=database.js.map