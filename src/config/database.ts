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
    if (config.NODE_ENV === 'test' || !config.MONGODB_URI) {
      logger.warn('Database connection is disabled. The application will run without connecting to MongoDB.');
      return;
    }

    try {
      await mongoose.connect(config.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000
      });
      logger.info('🔌 Connected to MongoDB');
      this.retryCount = 0; // Reset retry count on successful connection
      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected. Trying to reconnect...');
        this.handleConnectionError();
      });
    } catch (error) {
      logger.error('Initial MongoDB connection failed:', error);
      this.handleConnectionError();
    }
  }

  private handleConnectionError(): void {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      logger.error(`MongoDB connection error. Retrying in 5 seconds... (${this.retryCount}/${this.maxRetries})`);
      setTimeout(() => this.connect(), 5000);
    } else {
      logger.error('Could not connect to MongoDB after multiple retries. Exiting...');
      process.exit(1);
    }
  }

  async disconnect(): Promise<void> {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      logger.info('🔌 Disconnected from MongoDB');
    }
  }
}

export const database = Database.getInstance();
