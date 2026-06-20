import http from 'http';
import app from './app';
import { config, validateConfig } from './config';
import { database } from './config/database';
import { redisClient } from './config/redis';
import { logger } from './config/logger';
import { initializeFirebase } from './config/firebase';
import { socketServer } from './infrastructure/websocket/socket.server';
import { startReminderCron } from './modules/reminders/reminder.cron';
class Server {
  private httpServer: http.Server | null = null;

  async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();
      logger.info('Configuration validated successfully');

      // Connect to MongoDB
      await database.connect();

      // Connect to Redis
      await redisClient.connect();

      // Initialize Firebase
      initializeFirebase();

      // Create HTTP server (needed for Socket.IO)
      this.httpServer = http.createServer(app);

      // Initialize WebSocket server
      socketServer.initialize(this.httpServer);
      logger.info('🔌 WebSocket server initialized');

      // Start HTTP server
      this.httpServer.listen(config.PORT, '0.0.0.0', () => {
        logger.info(`🚀 WAKERU API Server running on port ${config.PORT}`);
        logger.info(`🔌 WebSocket server running on port ${config.PORT}`);
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

      // Close HTTP server (stops accepting new connections)
      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer!.close(() => {
            logger.info('HTTP server closed');
            resolve();
          });
        });
      }

      // Close WebSocket server
      await socketServer.shutdown();

      // Close Redis
      await redisClient.disconnect();

      // Close MongoDB
      await database.disconnect();

      logger.info('Graceful shutdown completed');
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
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });
  }
}

// Start server
const server = new Server();
server.start();
startReminderCron();


export default server;