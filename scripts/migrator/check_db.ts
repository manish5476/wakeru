import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const p = new PrismaClient();
  try {
    await p.$connect();
    console.log('Transactions:', await p.transaction.count());
    console.log('Budgets:', await p.budget.count());
    console.log('Bills:', await p.bill.count());
    console.log('Goals:', await p.goal.count());
    console.log('Debts:', await p.debt.count());
  } catch (e) {
    console.error(e);
  } finally {
    await p.$disconnect();
  }
}

main();
