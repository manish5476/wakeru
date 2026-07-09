const mongoose = require('mongoose');

const uri = "mongodb://dummymailme_db_user:ms201426@ac-zauklcv-shard-00-00.mxusxdr.mongodb.net:27017,ac-zauklcv-shard-00-01.mxusxdr.mongodb.net:27017,ac-zauklcv-shard-00-02.mxusxdr.mongodb.net:27017/?authSource=admin&replicaSet=atlas-gem9pk-shard-0&tls=true&appName=wakeru";

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected.");
  
  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');
  
  const users = await usersCollection.find({}).toArray();
  console.log(`Found ${users.length} users.`);
  
  let updated = 0;
  
  for (const user of users) {
    let needsUpdate = false;
    let newTokens = [];
    
    if (user.refreshTokens && Array.isArray(user.refreshTokens) && user.refreshTokens.length > 0) {
      if (typeof user.refreshTokens[0] === 'string') {
        console.log(`User ${user.email} has string refreshTokens. Converting...`);
        newTokens = user.refreshTokens.map(t => ({
          token: t,
          device: 'Unknown Device',
          ip: 'Unknown IP',
          lastActive: new Date()
        }));
        needsUpdate = true;
      } else if (typeof user.refreshTokens[0] === 'object' && !user.refreshTokens[0].token) {
        console.log(`User ${user.email} has invalid object refreshTokens. Clearing...`);
        newTokens = [];
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      await usersCollection.updateOne({ _id: user._id }, { $set: { refreshTokens: newTokens } });
      updated++;
    }
  }
  
  console.log(`Migration completed. Updated ${updated} users.`);
  process.exit(0);
}

run().catch(console.error);
