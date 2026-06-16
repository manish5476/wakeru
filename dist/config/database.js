"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.database = exports.Database = void 0;
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
        // MODIFIED: This function is disabled to allow the server to run without a database.
        logger_1.logger.warn('Database connection is disabled. The application will run without connecting to MongoDB.');
        return Promise.resolve();
    }
    handleConnectionError() {
        // MODIFIED: This function is disabled to prevent connection retries and application exit.
    }
    async disconnect() {
        // MODIFIED: This function is disabled.
        return Promise.resolve();
    }
    async healthCheck() {
        // MODIFIED: Always return false as the database is not connected.
        return false;
    }
}
exports.Database = Database;
exports.database = Database.getInstance();
//# sourceMappingURL=database.js.map