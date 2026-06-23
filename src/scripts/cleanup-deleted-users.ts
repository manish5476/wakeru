import { database } from '../config/database';
import { initializeFirebase } from '../config/firebase';
import { User } from '../modules/auth/auth.model';
import { getAuth } from 'firebase-admin/auth';
import { logger } from '../config/logger';

async function cleanupUsers() {
  try {
    console.log('Connecting to database...');
    await database.connect();
    
    console.log('Initializing Firebase...');
    initializeFirebase();

    // Find all users that were soft-deleted
    const deletedUsers = await User.find({ isDeleted: true });
    
    console.log(`Found ${deletedUsers.length} soft-deleted users.`);

    for (const user of deletedUsers) {
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
      
      // Permanently remove from database if desired:
      // await User.deleteOne({ _id: user._id });
      // console.log(`✅ Permanently removed user from database: ${user.email}`);
    }

    console.log('Cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupUsers();
