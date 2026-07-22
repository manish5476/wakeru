import { config } from 'dotenv';
import path from 'path';

// Load environment variables from the root .env
config({ path: path.join(__dirname, '../../.env') });

import { Migrator } from './core/Migrator';
import { MongoConnector } from './connectors/MongoConnector';
import { PostgresConnector } from './connectors/PostgresConnector';
import { FinanceTransformer } from './transformers/FinanceTransformer';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\n======================================`);
  console.log(`🛠️  TripSplit Data Migrator v1.0.0`);
  console.log(`======================================\n`);

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/tripsplit';
  const pgUri = process.env.DATABASE_URL;

  if (!pgUri) {
    throw new Error('DATABASE_URL is missing in .env');
  }
  
  const source = new MongoConnector();
  const dest = new PostgresConnector();

  await source.connect({ uri: mongoUri });
  await dest.connect({ uri: pgUri });

  try {
    // 1. Migrate Transactions
    const txTransformer = new FinanceTransformer('Transaction');
    const txMigrator = new Migrator(source, dest, txTransformer, dryRun);
    await txMigrator.run('transactions', 'Transaction');

    // 2. Migrate Budgets
    const budgetTransformer = new FinanceTransformer('Budget');
    const budgetMigrator = new Migrator(source, dest, budgetTransformer, dryRun);
    await budgetMigrator.run('budgets', 'Budget');

    // 3. Migrate Bills
    const billTransformer = new FinanceTransformer('Bill');
    const billMigrator = new Migrator(source, dest, billTransformer, dryRun);
    await billMigrator.run('bills', 'Bill');

    // 4. Migrate Goals
    const goalTransformer = new FinanceTransformer('Goal');
    const goalMigrator = new Migrator(source, dest, goalTransformer, dryRun);
    await goalMigrator.run('goals', 'Goal');

    // 5. Migrate Debts
    const debtTransformer = new FinanceTransformer('Debt');
    const debtMigrator = new Migrator(source, dest, debtTransformer, dryRun);
    await debtMigrator.run('debts', 'Debt');

  } catch (error) {
    console.error(`Migration Failed:`, error);
  } finally {
    await source.disconnect();
    await dest.disconnect();
    console.log(`\n👋 Exiting Migrator...`);
    process.exit(0);
  }
}

main();
