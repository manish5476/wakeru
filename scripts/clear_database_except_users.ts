import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

async function clearDatabaseExceptUsers() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('No MONGO_URI');
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  if (!db) throw new Error('Failed to get database instance');

  const collections = await db.listCollections().toArray();
  const summary: Record<string, { before: number; deleted: number; remaining: number }> = {};

  console.log('Clearing all collections EXCEPT `users`...');

  for (const col of collections) {
    const colName = col.name;
    const countBefore = await db.collection(colName).countDocuments();

    if (colName === 'users') {
      summary[colName] = { before: countBefore, deleted: 0, remaining: countBefore };
      console.log(`[PRESERVED] ${colName}: ${countBefore} documents kept.`);
      continue;
    }

    const deleteRes = await db.collection(colName).deleteMany({});
    const countAfter = await db.collection(colName).countDocuments();
    summary[colName] = {
      before: countBefore,
      deleted: deleteRes.deletedCount,
      remaining: countAfter
    };
    console.log(`[CLEARED] ${colName}: deleted ${deleteRes.deletedCount} documents (remaining: ${countAfter}).`);
  }

  console.log('\n=== OPERATION COMPLETE ===');
  console.log('Summary:', JSON.stringify(summary, null, 2));

  await mongoose.disconnect();
}

clearDatabaseExceptUsers().catch(err => {
  console.error('Clear failed:', err);
  process.exit(1);
});
