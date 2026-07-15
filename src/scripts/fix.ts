import { database } from '../config/database';
import { User } from '../modules/auth/auth.model';

async function fix() {
  await database.connect();
  await User.updateOne(
    { email: 'msms5476mm@gmail.com' },
    { $set: { firebaseUid: '7Io04MDBz2Rxfq0cNPJiFk4HR6e2' } }
  );
  console.log('Fixed user');
  process.exit(0);
}
fix();
