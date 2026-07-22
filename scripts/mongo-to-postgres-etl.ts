import mongoose from 'mongoose';
import { logger } from '../src/config/logger';

// ============================================================================
// MONGODB TO POSTGRESQL ETL (Change Data Capture)
// 
// WHY THIS EXISTS:
// When you eventually move the Finance module to PostgreSQL (using Prisma),
// you will need to keep MongoDB and PostgreSQL in sync. 
// This script uses MongoDB Change Streams to listen for any inserted/updated 
// expenses in real-time and pipe them to PostgreSQL.
// ============================================================================

async function runEtl() {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) throw new Error('MONGODB_URI not found');

  logger.info('🔄 Connecting to MongoDB to start Change Data Capture...');
  await mongoose.connect(MONGO_URI);

  // Example: Listen to the "expenses" collection
  const ExpenseCollection = mongoose.connection.collection('expenses');
  
  // Create a Change Stream (Requires MongoDB Replica Set — Atlas Free Tier supports this)
  const changeStream = ExpenseCollection.watch();

  logger.info('✅ Listening for real-time changes on MongoDB "expenses" collection...');

  changeStream.on('change', async (change) => {
    try {
      if (change.operationType === 'insert') {
        const fullDocument = change.fullDocument;
        logger.info(`📥 New Expense detected in Mongo: ${fullDocument._id}`);
        
        // TODO (Future): 
        // await prisma.expense.create({ data: { title: fullDocument.title, ... } })
        logger.info(`📤 Syncing to PostgreSQL (Simulated)`);
      }
      
      else if (change.operationType === 'update') {
        const documentKey = change.documentKey;
        const updatedFields = change.updateDescription?.updatedFields;
        logger.info(`📝 Expense updated in Mongo: ${documentKey._id}`);
        
        // TODO (Future): 
        // await prisma.expense.update({ where: { id: documentKey._id }, data: updatedFields })
        logger.info(`📤 Syncing to PostgreSQL (Simulated)`);
      }
    } catch (err) {
      logger.error('❌ Failed to sync change to PostgreSQL', err);
    }
  });

  changeStream.on('error', (error) => {
    logger.error('🚨 Change Stream Error:', error);
  });
}

if (require.main === module) {
  runEtl().catch(err => {
    logger.error('ETL Fatal Error', err);
    process.exit(1);
  });
}
