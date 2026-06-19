import { getAuth } from 'firebase-admin/auth';
import { initializeFirebase } from './src/config/firebase';
import dotenv from 'dotenv';
dotenv.config();

async function clearFirebaseAuth() {
  console.log('Initializing Firebase...');
  initializeFirebase();
  const auth = getAuth();
  
  let pageToken: string | undefined;
  let count = 0;
  
  do {
    const listUsersResult = await auth.listUsers(1000, pageToken);
    const uids = listUsersResult.users.map(u => u.uid);
    if (uids.length > 0) {
      const deleteResult = await auth.deleteUsers(uids);
      count += deleteResult.successCount;
      console.log(`Deleted ${deleteResult.successCount} users. Failed: ${deleteResult.failureCount}`);
    }
    pageToken = listUsersResult.pageToken;
  } while (pageToken);
  
  console.log(`Finished clearing Firebase Auth. Total users deleted: ${count}`);
}

clearFirebaseAuth().catch(console.error);
