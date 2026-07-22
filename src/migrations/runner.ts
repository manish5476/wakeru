import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../config/logger';

// ── Internal Model to track migrations ──
const migrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now }
});
const Migration = mongoose.model('Migration', migrationSchema);

const MIGRATIONS_DIR = path.join(__dirname, 'scripts');

async function connectDB() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(config.MONGODB_URI);
    logger.info('📦 MongoDB connected for migrations');
  }
}

async function runMigrations() {
  await connectDB();

  // Create directory if it doesn't exist
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    logger.info('Created migrations directory.');
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.ts') && file !== 'template.ts')
    .sort(); // Run in alphabetical (timestamp) order

  const appliedMigrations = await Migration.find().select('name').lean();
  const appliedNames = new Set(appliedMigrations.map(m => m.name));

  let count = 0;
  for (const file of files) {
    if (!appliedNames.has(file)) {
      logger.info(`🚀 Running migration: ${file}`);
      const migration = require(path.join(MIGRATIONS_DIR, file));
      
      try {
        await migration.up();
        await Migration.create({ name: file });
        logger.info(`✅ Migration successful: ${file}`);
        count++;
      } catch (error: any) {
        logger.error(`❌ Migration failed: ${file}`, error);
        logger.info(`Attempting rollback for: ${file}`);
        try {
          if (migration.down) {
            await migration.down();
            logger.info(`✅ Rollback successful for: ${file}`);
          }
        } catch (rollbackError: any) {
          logger.error(`🚨 Rollback failed for: ${file}`, rollbackError);
        }
        process.exit(1); // Stop execution on failure
      }
    }
  }

  if (count === 0) {
    logger.info('✨ All migrations are up to date.');
  } else {
    logger.info(`🎉 Successfully applied ${count} migrations.`);
  }

  await mongoose.disconnect();
}

// Support CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'create') {
    const name = args[1];
    if (!name) {
      console.error('Please provide a migration name (e.g. npm run migrate create add-field)');
      process.exit(1);
    }
    const timestamp = Date.now();
    const filename = `${timestamp}-${name}.ts`;
    const templatePath = path.join(__dirname, 'template.ts');
    const targetPath = path.join(MIGRATIONS_DIR, filename);
    
    if (!fs.existsSync(MIGRATIONS_DIR)) fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    
    fs.copyFileSync(templatePath, targetPath);
    console.log(`Created new migration file: ${targetPath}`);
    process.exit(0);
  } else {
    runMigrations().catch(err => {
      console.error('Migration framework error:', err);
      process.exit(1);
    });
  }
}

export { runMigrations };
