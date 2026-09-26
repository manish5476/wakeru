import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

async function exportDatabase() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('No MONGO_URI');
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  if (!db) throw new Error('Failed to get database instance');

  const collections = await db.listCollections().toArray();
  const backupDir = path.join(__dirname, '..', 'backup_db_' + new Date().toISOString().replace(/[:.]/g, '-'));
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`Starting backup to directory: ${backupDir}`);
  const summary: Record<string, number> = {};

  for (const col of collections) {
    const colName = col.name;
    const count = await db.collection(colName).countDocuments();
    summary[colName] = count;
    console.log(`Exporting ${colName} (${count} documents)...`);
    
    const docs = await db.collection(colName).find({}).toArray();
    const filePath = path.join(backupDir, `${colName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
  }

  console.log('=== BACKUP COMPLETE ===');
  console.log('Summary:', JSON.stringify(summary, null, 2));
  console.log(`Backup saved in: ${backupDir}`);

  await mongoose.disconnect();
}

exportDatabase().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
