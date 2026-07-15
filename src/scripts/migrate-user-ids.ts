import { database } from '../config/database';
import { User } from '../modules/auth/auth.model';
import { Media } from '../modules/media/media.model';
import mongoose from 'mongoose';

async function migrateUserIds() {
  try {
    console.log('Connecting to database...');
    await database.connect();

    // Find all users
    const allUsers = await User.find({}).lean();
    console.log(`Found ${allUsers.length} total users in database.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of allUsers) {
      // Check if _id is a UUID (UUIDs are 36 characters long, Firebase UIDs are typically ~28)
      // The most reliable check is if _id !== firebaseUid
      if (user._id !== user.firebaseUid && user.firebaseUid) {
        console.log(`Migrating user: ${user.email} (Old ID: ${user._id} -> New ID: ${user.firebaseUid})`);

        const oldId = user._id;
        const newId = user.firebaseUid;

        // 1. Rename the old document's unique fields to avoid unique index conflict
        await User.updateOne({ _id: oldId }, { 
          $set: { 
            firebaseUid: oldId + '-migrating',
            email: oldId + '@migrating.com',
            ...(user.phoneNumber ? { phoneNumber: oldId + '-migrating' } : {})
          } 
        });

        // 2. Create a clone of the user document with the new _id and the original firebaseUid
        const newDoc = { ...user, _id: newId, firebaseUid: newId };
        
        // Use raw collection methods to bypass Mongoose _id restrictions
        await mongoose.connection.db?.collection('users').insertOne(newDoc);

        // 3. Update Media references
        const mediaUpdateResult = await Media.updateMany(
          { uploadedBy: oldId },
          { $set: { uploadedBy: newId } }
        );
        if (mediaUpdateResult.modifiedCount > 0) {
          console.log(`  -> Updated ${mediaUpdateResult.modifiedCount} Media documents`);
        }

        // 4. Delete the old user document
        await User.deleteOne({ _id: oldId });
        
        console.log(`  -> Successfully migrated ${user.email}`);
        migratedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`\nMigration Complete!`);
    console.log(`Migrated: ${migratedCount} users`);
    console.log(`Skipped: ${skippedCount} users (already migrated or no firebaseUid)`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

migrateUserIds();
