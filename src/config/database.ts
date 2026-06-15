import mongoose from 'mongoose';
import { config } from './index';
import { logger } from './logger';

export class Database {
  private static instance: Database;
  private retryCount: number = 0;
  private maxRetries: number = 5;

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    try {
      const options: mongoose.ConnectOptions = {
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        w: 'majority',
      };

      mongoose.connection.on('connected', () => {
        logger.info('✅ MongoDB connected successfully');
        this.retryCount = 0;
      });

      mongoose.connection.on('error', (error) => {
        logger.error('❌ MongoDB connection error:', error);
        this.handleConnectionError();
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('⚠️ MongoDB disconnected');
        this.handleConnectionError();
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed due to app termination');
        process.exit(0);
      });

      await mongoose.connect(config.MONGODB_URI, options);
      
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      this.handleConnectionError();
    }
  }

  private handleConnectionError(): void {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
      
      logger.info(`Retrying connection in ${delay}ms... (Attempt ${this.retryCount}/${this.maxRetries})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      logger.error('Max retries reached. Exiting application.');
      process.exit(1);
    }
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const state = mongoose.connection.readyState;
      return state === 1; // 1 = connected
    } catch {
      return false;
    }
  }
}

export const database = Database.getInstance();