import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

import { settlementService } from '../src/modules/settlement/settlement.service';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('No MONGO_URI');
  await mongoose.connect(uri);

  const tripId = '6a58bed14a4e6dc9456c9528';
  const userId = 'tO5MslLBBGSnj7XqUd9GGEl5IrQ2';

  const settlement = await settlementService.getSettlement(tripId, userId);
  console.log('GET SETTLEMENT RESULT:');
  console.log('Transactions:', JSON.stringify(settlement.transactions.map((t: any) => ({
    id: t._id,
    from: t.fromName,
    fromId: t.from,
    to: t.toName,
    toId: t.to,
    amountBase: t.amountBase,
    status: t.status,
  })), null, 2));

  console.log('\nRecalculating fresh settlement...');
  const fresh = await settlementService.calculateSettlement(tripId, userId);
  console.log('FRESH TRANSACTIONS:', JSON.stringify(fresh.transactions.map((t: any) => ({
    id: t._id,
    from: t.fromName,
    fromId: t.from,
    to: t.toName,
    toId: t.to,
    amountBase: t.amountBase,
    status: t.status,
  })), null, 2));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
