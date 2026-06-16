import app from './app';
import { config, validateConfig } from './config';
import { database } from './config/database';
import { redisClient } from './config/redis';
import { logger } from './config/logger';
import { QueueManager } from './infrastructure/queue/bull.config';

class Server {
  private server: any;

  async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();
      logger.info('Configuration validated successfully');

      // Connect to MongoDB
      await database.connect();

      // Connect to Redis
      await redisClient.connect();

      // Initialize job queues (MODIFIED: Disabled)
      // QueueManager.getQueue('ocr-processing');
      // QueueManager.getQueue('analytics-generation');
      // logger.info('Job queues initialized');

      // Start HTTP server
      this.server = app.listen(config.PORT, () => {
        logger.info(`🚀 WAKERU API Server running on port ${config.PORT}`);
        logger.info(`📚 API Documentation: http://localhost:${config.PORT}/api-docs`);
        logger.info(`🏥 Health Check: http://localhost:${config.PORT}/health`);
        logger.info(`🌍 Environment: ${config.NODE_ENV}`);
      });

      // Graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      // Close queues (MODIFIED: Disabled)
      // await QueueManager.closeAll();

      // Close Redis
      await redisClient.disconnect();

      // Close MongoDB
      await database.disconnect();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });
  }
}

// Start server
const server = new Server();
server.start();

export default server;