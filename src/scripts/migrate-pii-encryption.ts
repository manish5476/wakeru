import mongoose from 'mongoose';
import { config } from '../config';
import { User } from '../modules/auth/auth.model';
import { PiiCryptoService } from '../shared/utils/piiCrypto.service';
import { logger } from '../config/logger';

async function migratePiiEncryption() {
  logger.info('🚀 Starting PII Phone Number Encryption & Blind Index Migration...');

  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info(' Connected to MongoDB');

    // Find users with legacy phoneNumber who need encryption or blind indexing
    const cursor = User.collection.find({
      $or: [
        { phoneNumber: { $exists: true, $nin: [null, ''] } },
        { phoneEncrypted: { $exists: true, $nin: [null, ''] }, phoneSearchIndex: { $exists: false } },
      ],
    });

    let total = 0;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;
      total++;

      try {
        let rawPhone = doc.phoneNumber;

        // If phoneEncrypted exists, decrypt it first if phoneNumber is missing
        if (!rawPhone && doc.phoneEncrypted) {
          rawPhone = PiiCryptoService.decrypt(doc.phoneEncrypted);
        }

        if (!rawPhone) {
          skipped++;
          continue;
        }

        const canonical = PiiCryptoService.normalizePhoneNumber(rawPhone);
        if (!canonical) {
          logger.warn(` Skipping invalid phone format for user ${doc._id}`);
          skipped++;
          continue;
        }

        const blindIndex = PiiCryptoService.computeBlindIndex(canonical);
        const encrypted = PiiCryptoService.encrypt(canonical);

        await User.collection.updateOne(
          { _id: doc._id },
          {
            $set: {
              phoneEncrypted: encrypted,
              phoneSearchIndex: blindIndex,
              encryptionVersion: 1,
            },
            $unset: {
              phoneNumber: '',
            },
          }
        );

        migrated++;
        if (migrated % 50 === 0) {
          logger.info(` Migrated ${migrated} records...`);
        }
      } catch (err: any) {
        errors++;
        logger.error(` Error migrating user ${doc._id}: ${err.message}`);
      }
    }

    logger.info('═══════════════════════════════════════════════════════');
    logger.info(` PII Migration Completed Successfully:`);
    logger.info(`   Total Evaluated: ${total}`);
    logger.info(`   Migrated:        ${migrated}`);
    logger.info(`   Skipped:         ${skipped}`);
    logger.info(`   Errors:          ${errors}`);
    logger.info('═══════════════════════════════════════════════════════');
  } catch (error: any) {
    logger.error(` Fatal migration error: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info(' Disconnected from MongoDB');
  }
}

if (require.main === module) {
  migratePiiEncryption()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export { migratePiiEncryption };
