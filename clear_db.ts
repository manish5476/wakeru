import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function clearDb() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MongoDB URI found in environment');
    process.exit(1);
  }
  
  await mongoose.connect(uri);
  console.log('Connected to DB');
  
  const db = mongoose.connection.db;
  if (!db) {
    console.error('DB connection failed');
    process.exit(1);
  }

  const collections = await db.collections();
  for (let collection of collections) {
      await collection.drop();
      console.log(`Dropped collection: ${collection.collectionName}`);
  }
  console.log('Database collections cleared completely.');
  
  await mongoose.disconnect();
  console.log('Disconnected');
}

clearDb().catch(console.error);
