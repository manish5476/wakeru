import { PrismaClient } from '@prisma/client';
import { ISourceConnector, IDestinationConnector, IConnectorConfig } from '../core/interfaces';

export class PostgresConnector implements ISourceConnector, IDestinationConnector {
  name = 'PostgreSQL';
  private prisma: PrismaClient | null = null;

  async connect(config: IConnectorConfig): Promise<void> {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.uri,
        },
      },
    });
    await this.prisma.$connect();
    console.log(`🔌 Connected to PostgreSQL via Prisma`);
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
    console.log(`🔌 Disconnected from PostgreSQL`);
  }

  async extract(tableName: string, batchSize: number, onBatch: (data: any[]) => Promise<void>): Promise<void> {
    throw new Error('Postgres extraction not implemented yet');
  }

  async load(tableName: string, data: any[]): Promise<void> {
    if (!this.prisma) throw new Error('Postgres DB not connected');
    if (data.length === 0) return;

    const delegate = (this.prisma as any)[tableName.toLowerCase()];
    if (!delegate) {
      throw new Error(`Model ${tableName} not found in Prisma Client`);
    }

    try {
      // Loop to support nested creations (like categoryBudgets in Budget)
      for (const item of data) {
        await delegate.upsert({
          where: { id: item.id },
          update: item,
          create: item
        });
      }
      // console.log(`[PostgresConnector] 📥 Inserted ${data.length} records into ${tableName}`);
    } catch (error) {
      console.error(`[PostgresConnector] ❌ Failed to insert into ${tableName}:`, error);
      throw error;
    }
  }
}
