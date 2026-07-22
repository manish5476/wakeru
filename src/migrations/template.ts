import mongoose from 'mongoose';
import { logger } from '../config/logger';

/**
 * Make your schema changes in the up() function.
 * Use Mongoose's raw collection methods for speed, or your Models for business logic.
 */
export async function up() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection lost');

  // Example: Add a new field to all users
  // await db.collection('users').updateMany(
  //   { newField: { $exists: false } },
  //   { $set: { newField: 'defaultValue' } }
  // );
  
  logger.info('Running migration script...');
}

/**
 * The down() function should revert exactly what up() did.
 * This is automatically called if up() fails halfway, or can be run manually.
 */
export async function down() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection lost');

  // Example: Remove the field we just added
  // await db.collection('users').updateMany(
  //   {},
  //   { $unset: { newField: "" } }
  // );

  logger.info('Reverting migration script...');
}
