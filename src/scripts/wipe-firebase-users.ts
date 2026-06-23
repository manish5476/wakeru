import { initializeFirebase } from '../config/firebase';
import { getAuth } from 'firebase-admin/auth';

async function wipeFirebaseUsers() {
  try {
    console.log('Initializing Firebase...');
    initializeFirebase();

    console.log('Fetching all users from Firebase...');
    const listUsersResult = await getAuth().listUsers(1000);
    const users = listUsersResult.users;

    console.log(`Found ${users.length} users in Firebase.`);

    for (const user of users) {
      try {
        await getAuth().deleteUser(user.uid);
        console.log(`✅ Deleted Firebase user: ${user.email} (${user.uid})`);
      } catch (err: any) {
        console.error(`❌ Failed to delete Firebase user ${user.email}:`, err.message);
      }
    }

    console.log('Firebase wipe complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error during wipe:', error);
    process.exit(1);
  }
}

wipeFirebaseUsers();
