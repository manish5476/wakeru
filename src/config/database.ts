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
    // MODIFIED: This function is disabled to allow the server to run without a database.
    logger.warn('Database connection is disabled. The application will run without connecting to MongoDB.');
    return Promise.resolve();
  }

  private handleConnectionError(): void {
    // MODIFIED: This function is disabled to prevent connection retries and application exit.
  }

  async disconnect(): Promise<void> {
    // MODIFIED: This function is disabled.
    return Promise.resolve();
  }

  async healthCheck(): Promise<boolean> {
    // MODIFIED: Always return false as the database is not connected.
    return false;
  }
}

export const database = Database.getInstance();
