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
        if (index_1.config.NODE_ENV === 'test' || !index_1.config.MONGODB_URI) {
            logger_1.logger.warn('Database connection is disabled. The application will run without connecting to MongoDB.');
            return;
        }
        try {
            await mongoose_1.default.connect(index_1.config.MONGODB_URI, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000
            });
            logger_1.logger.info('🔌 Connected to MongoDB');
            this.retryCount = 0; // Reset retry count on successful connection
            mongoose_1.default.connection.on('disconnected', () => {
                logger_1.logger.warn('MongoDB disconnected. Trying to reconnect...');
                this.handleConnectionError();
            });
        }
        catch (error) {
            logger_1.logger.error('Initial MongoDB connection failed:', error);
            this.handleConnectionError();
        }
    }
    handleConnectionError() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            logger_1.logger.error(`MongoDB connection error. Retrying in 5 seconds... (${this.retryCount}/${this.maxRetries})`);
            setTimeout(() => this.connect(), 5000);
        }
        else {
            logger_1.logger.error('Could not connect to MongoDB after multiple retries. Exiting...');
            process.exit(1);
        }
    }
    async disconnect() {
        if (mongoose_1.default.connection.readyState === 1) {
            await mongoose_1.default.disconnect();
            logger_1.logger.info('🔌 Disconnected from MongoDB');
        }
    }
}
exports.Database = Database;
exports.database = Database.getInstance();
//# sourceMappingURL=database.js.map