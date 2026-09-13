import mongoose from 'mongoose';
import { config } from '../src/config';
import { User } from '../src/modules/auth/auth.model';

async function main() {
  console.log('====================================================');
  console.log('         WAKERU ADMIN & OWNER MANAGER CLI           ');
  console.log('====================================================');
  console.log(`Configured Owner Email : ${config.OWNER_EMAIL}`);
  console.log(`Configured Admin Emails: ${config.ADMIN_EMAILS.join(', ')}`);
  console.log('Connecting to MongoDB...');

  await mongoose.connect(config.MONGODB_URI);
  console.log('Connected to MongoDB successfully.\n');

  // Auto-promote configured admin and owner emails if not already admin
  for (const adminEmail of config.ADMIN_EMAILS) {
    const user = await User.findOne({ email: adminEmail });
    if (user) {
      if (user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
        console.log(`[PROMOTED] User ${adminEmail} updated to role: 'admin'`);
      } else {
        console.log(`[VERIFIED] User ${adminEmail} is already confirmed as 'admin'`);
      }
    } else {
      console.log(`[NOTICE] Admin email ${adminEmail} is configured in .env but hasn't registered in the DB yet.`);
    }
  }

  // Handle manual command-line argument: npm run admin -- promote someone@example.com
  const args = process.argv.slice(2);
  const action = args[0]?.toLowerCase();
  const targetEmail = args[1]?.toLowerCase();

  if (action && targetEmail) {
    if (action === 'promote') {
      const res = await User.updateOne({ email: targetEmail }, { $set: { role: 'admin' } });
      if (res.matchedCount > 0) {
        console.log(`\nSuccessfully promoted ${targetEmail} to 'admin'.`);
      } else {
        console.log(`\nUser with email ${targetEmail} not found in database.`);
      }
    } else if (action === 'demote') {
      if (targetEmail === config.OWNER_EMAIL.toLowerCase()) {
        console.error(`\nCannot demote ${targetEmail} because it is the primary OWNER_EMAIL.`);
      } else {
        const res = await User.updateOne({ email: targetEmail }, { $set: { role: 'user' } });
        if (res.matchedCount > 0) {
          console.log(`\nSuccessfully demoted ${targetEmail} to 'user'.`);
        } else {
          console.log(`\nUser with email ${targetEmail} not found in database.`);
        }
      }
    }
  }

  // Display all current admins in DB
  const currentAdmins = await User.find({ role: 'admin' }, 'email displayName role createdAt').lean();
  console.log('\n--- Current Registered Admins in Database ---');
  if (currentAdmins.length === 0) {
    console.log('No users with role "admin" found.');
  } else {
    currentAdmins.forEach((adm, idx) => {
      const isOwner = (adm.email || '').toLowerCase() === config.OWNER_EMAIL.toLowerCase();
      console.log(
        `${idx + 1}. ${adm.email} | Name: ${adm.displayName || 'N/A'} | Role: ${adm.role} ${isOwner ? '👑 (MAIN OWNER)' : '🛡️ (ADMIN)'}`
      );
    });
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error running admin manager:', err);
  process.exit(1);
});
