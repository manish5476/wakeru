import mongoose from 'mongoose';
import { ISourceConnector, IDestinationConnector, IConnectorConfig } from '../core/interfaces';

export class MongoConnector implements ISourceConnector, IDestinationConnector {
  name = 'MongoDB';

  async connect(config: IConnectorConfig): Promise<void> {
    await mongoose.connect(config.uri, config.options);
    console.log(`🔌 Connected to MongoDB`);
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect();
    console.log(`🔌 Disconnected from MongoDB`);
  }

  async extract(collectionName: string, batchSize: number, onBatch: (data: any[]) => Promise<void>): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');
    
    const collection = db.collection(collectionName);
    const cursor = collection.find({}).batchSize(batchSize);

    let batch: any[] = [];
    for await (const doc of cursor) {
      batch.push(doc);
      if (batch.length === batchSize) {
        await onBatch(batch);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await onBatch(batch);
    }
  }

  async load(collectionName: string, data: any[]): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');
    
    if (data.length === 0) return;
    
    const collection = db.collection(collectionName);
    // Use insertMany for bulk inserts
    await collection.insertMany(data);
  }
}
