import mongoose from 'mongoose';
import { logger } from '../src/config/logger';

// ============================================================================
// ENVIRONMENT DATABASE SYNC SCRIPT
//
// Usage: 
// npx ts-node scripts/db-sync.ts --source="mongodb://..." --target="mongodb://..." --collections="users,expenses"
// 
// Flags:
// --source=<URI>        The DB you want to copy FROM
// --target=<URI>        The DB you want to copy TO
// --collections=<c,d>   Comma-separated list of collections (leave empty for ALL)
// --drop-target         If passed, it will wipe the target collections before copying
// ============================================================================

async function runSync() {
  const args = process.argv.slice(2);
  const getArg = (name: string) => args.find(a => a.startsWith(name))?.split('=')[1];
  const hasFlag = (name: string) => args.some(a => a === name);

  const sourceUri = getArg('--source');
  const targetUri = getArg('--target');
  const collectionsArg = getArg('--collections');
  const dropTarget = hasFlag('--drop-target');

  if (!sourceUri || !targetUri) {
    logger.error('Missing required arguments: --source and --target');
    console.log('Usage: npx ts-node scripts/db-sync.ts --source="URI" --target="URI" [--collections="users,expenses"] [--drop-target]');
    process.exit(1);
  }

  logger.info('🔄 Starting Database Sync...');
  
  // 1. Connect to both databases
  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  const targetConn = await mongoose.createConnection(targetUri).asPromise();
  logger.info('✅ Connected to both Source and Target databases');

  // 2. Determine which collections to copy
  let collectionsToCopy: string[] = [];
  if (collectionsArg) {
    collectionsToCopy = collectionsArg.split(',').map(c => c.trim());
  } else {
    // Get all collections from source
    const collections = await sourceConn.db!.listCollections().toArray();
    collectionsToCopy = collections.map(c => c.name).filter(name => !name.startsWith('system.'));
  }

  logger.info(`📦 Syncing collections: ${collectionsToCopy.join(', ')}`);

  // 3. Sync each collection
  for (const collName of collectionsToCopy) {
    try {
      const sourceDb = sourceConn.db!;
      const targetDb = targetConn.db!;
      
      const sourceColl = sourceDb.collection(collName);
      const targetColl = targetDb.collection(collName);

      // Wipe target if requested
      if (dropTarget) {
        logger.info(`🗑️  Dropping target collection: ${collName}`);
        await targetColl.deleteMany({});
      }

      logger.info(`📥 Reading from source: ${collName}...`);
      const documents = await sourceColl.find({}).toArray();

      if (documents.length === 0) {
        logger.info(`⏭️  Skipping ${collName} (0 documents)`);
        continue;
      }

      logger.info(`📤 Writing ${documents.length} documents to target: ${collName}...`);
      
      // Use ordered: false to continue if some documents already exist (duplicate key errors)
      const result = await targetColl.insertMany(documents, { ordered: false }).catch((err: any) => {
        // If it's just duplicate key errors, we report them but continue
        if (err.code === 11000) {
          logger.warn(`⚠️  Skipped ${err.writeErrors?.length || 'some'} duplicate documents in ${collName}`);
          return { insertedCount: documents.length - (err.writeErrors?.length || 0) };
        }
        throw err;
      });

      logger.info(`✅ Successfully synced ${result.insertedCount} documents for ${collName}`);
    } catch (err: any) {
      logger.error(`❌ Failed to sync collection ${collName}:`, err.message);
    }
  }

  logger.info('🎉 Database Sync Complete!');
  
  await sourceConn.close();
  await targetConn.close();
  process.exit(0);
}

if (require.main === module) {
  runSync();
}
