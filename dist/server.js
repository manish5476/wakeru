"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config");
const database_1 = require("./config/database");
const logger_1 = require("./config/logger");
class Server {
    async start() {
        try {
            // Validate configuration
            (0, config_1.validateConfig)();
            logger_1.logger.info('Configuration validated successfully');
            // Connect to MongoDB
            await database_1.database.connect();
            // logger.info('MongoDB connected successfully');
            // Connect to Redis
            // await redisClient.connect();
            // logger.info('Redis connected successfully');
            // Initialize job queues
            // QueueManager.getQueue('ocr-processing');
            // QueueManager.getQueue('analytics-generation');
            // logger.info('Job queues initialized');
            // Start HTTP server
            this.server = app_1.default.listen(config_1.config.PORT, () => {
                logger_1.logger.info(`🚀 WAKERU API Server running on port ${config_1.config.PORT}`);
                logger_1.logger.info(`📚 API Documentation: http://localhost:${config_1.config.PORT}/api-docs`);
                logger_1.logger.info(`🏥 Health Check: http://localhost:${config_1.config.PORT}/health`);
                logger_1.logger.info(`🌍 Environment: ${config_1.config.NODE_ENV}`);
            });
            // Graceful shutdown
            this.setupGracefulShutdown();
        }
        catch (error) {
            logger_1.logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            logger_1.logger.info(`${signal} received. Starting graceful shutdown...`);
            // Close HTTP server
            if (this.server) {
                this.server.close(() => {
                    logger_1.logger.info('HTTP server closed');
                });
            }
            // Close queues
            // await QueueManager.closeAll();
            // Close Redis
            // await redisClient.disconnect();
            // Close MongoDB
            // await database.disconnect();
            logger_1.logger.info('Graceful shutdown completed');
            process.exit(0);
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught Exception:', error);
            shutdown('UNCAUGHT_EXCEPTION');
        });
    }
}
// Start server
const server = new Server();
server.start();
exports.default = server;
//# sourceMappingURL=server.js.map