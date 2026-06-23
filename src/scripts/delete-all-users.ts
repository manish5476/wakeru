import { database } from '../config/database';
import { initializeFirebase } from '../config/firebase';
import { User } from '../modules/auth/auth.model';
import { getAuth } from 'firebase-admin/auth';

async function deleteAllUsers() {
  try {
    console.log('Connecting to database...');
    await database.connect();
    
    console.log('Initializing Firebase...');
    initializeFirebase();

    // Find all users
    const allUsers = await User.find({});
    
    console.log(`Found ${allUsers.length} total users in database.`);

    for (const user of allUsers) {
      if (user.firebaseUid) {
        try {
          await getAuth().deleteUser(user.firebaseUid);
          console.log(`✅ Deleted Firebase user: ${user.email} (${user.firebaseUid})`);
        } catch (err: any) {
          if (err.code === 'auth/user-not-found') {
            console.log(`⚠️ Firebase user already deleted: ${user.email}`);
          } else {
            console.error(`❌ Failed to delete Firebase user ${user.email}:`, err.message);
          }
        }
      }
    }

    // Permanently remove all users from database
    await User.deleteMany({});
    console.log(`✅ Permanently removed all users from database`);

    console.log('Complete system wipe for users is finished!');
    process.exit(0);
  } catch (error) {
    console.error('Error during wipe:', error);
    process.exit(1);
  }
}

deleteAllUsers();
