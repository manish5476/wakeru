"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const logger_1 = require("./config/logger");
const firebase_1 = require("./config/firebase");
const socket_server_1 = require("./infrastructure/websocket/socket.server");
const reminder_cron_1 = require("./modules/reminders/reminder.cron");
class Server {
    constructor() {
        this.httpServer = null;
    }
    async start() {
        try {
            // Validate configuration
            (0, config_1.validateConfig)();
            logger_1.logger.info('Configuration validated successfully');
            // Connect to MongoDB
            await database_1.database.connect();
            // Connect to Redis
            await redis_1.redisClient.connect();
            // Initialize Firebase
            (0, firebase_1.initializeFirebase)();
            // Create HTTP server (needed for Socket.IO)
            this.httpServer = http_1.default.createServer(app_1.default);
            // Initialize WebSocket server
            socket_server_1.socketServer.initialize(this.httpServer);
            logger_1.logger.info('🔌 WebSocket server initialized');
            // Start HTTP server
            this.httpServer.listen(config_1.config.PORT, '0.0.0.0', () => {
                logger_1.logger.info(`🚀 WAKERU API Server running on port ${config_1.config.PORT}`);
                logger_1.logger.info(`🔌 WebSocket server running on port ${config_1.config.PORT}`);
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
            // Close HTTP server (stops accepting new connections)
            if (this.httpServer) {
                await new Promise((resolve) => {
                    this.httpServer.close(() => {
                        logger_1.logger.info('HTTP server closed');
                        resolve();
                    });
                });
            }
            // Close WebSocket server
            await socket_server_1.socketServer.shutdown();
            // Close Redis
            await redis_1.redisClient.disconnect();
            // Close MongoDB
            await database_1.database.disconnect();
            logger_1.logger.info('Graceful shutdown completed');
            process.exit(0);
        };
        // Handle termination signals
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        // Handle nodemon restarts gracefully
        process.once('SIGUSR2', async () => {
            await shutdown('SIGUSR2');
            process.kill(process.pid, 'SIGUSR2');
        });
        // Handle unhandled rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught Exception:', error);
            shutdown('UNCAUGHT_EXCEPTION');
        });
    }
}
// Start server
const server = new Server();
server.start();
(0, reminder_cron_1.startReminderCron)();
exports.default = server; // server restarted
//# sourceMappingURL=server.js.map