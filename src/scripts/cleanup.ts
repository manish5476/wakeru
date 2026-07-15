import { database } from '../config/database';
import { User } from '../modules/auth/auth.model';

async function cleanup() {
  await database.connect();
  const res = await User.deleteMany({ email: { $regex: /@migrating\.com$/ } });
  console.log(`Deleted ${res.deletedCount} broken documents`);
  process.exit(0);
}
cleanup();
