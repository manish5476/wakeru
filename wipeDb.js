const mongoose = require('mongoose');

const uri = "mongodb://dummymailme_db_user:ms201426@ac-zauklcv-shard-00-00.mxusxdr.mongodb.net:27017,ac-zauklcv-shard-00-01.mxusxdr.mongodb.net:27017,ac-zauklcv-shard-00-02.mxusxdr.mongodb.net:27017/?authSource=admin&replicaSet=atlas-gem9pk-shard-0&tls=true&appName=wakeru";

async function main() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");

    const collections = await mongoose.connection.db.listCollections().toArray();
    const collNames = collections.map(c => c.name);

    for (const name of ['trips', 'expenses', 'settlements', 'stops']) {
      if (collNames.includes(name)) {
        await mongoose.connection.db.dropCollection(name);
        console.log(`Dropped collection: ${name}`);
      } else {
        console.log(`Collection does not exist: ${name}`);
      }
    }

    console.log("Database cleanup complete.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
