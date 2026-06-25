import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Notification } from '../src/modules/notification/notification.model';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('Connected to MongoDB');
    
    console.log('Syncing Notification indexes...');
    await Notification.syncIndexes();
    console.log('Indexes synced successfully!');
    
  } catch (error) {
    console.error('Error syncing indexes:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
