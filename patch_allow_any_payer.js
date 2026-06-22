const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://dummymailme_db_user:ms201426@ac-zauklcv-shard-00-00.mxusxdr.mongodb.net:27017,ac-zauklcv-shard-00-01.mxusxdr.mongodb.net:27017,ac-zauklcv-shard-00-02.mxusxdr.mongodb.net:27017/?authSource=admin&replicaSet=atlas-gem9pk-shard-0&tls=true&appName=wakeru';

mongoose.connect(MONGO_URI).then(async () => {
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.collection('trips').updateMany(
        { allowAnyPayer: false },
        { $set: { allowAnyPayer: true } }
    );
    console.log('Updated trips (was false):', result.modifiedCount);

    const result2 = await mongoose.connection.collection('trips').updateMany(
        { allowAnyPayer: { $exists: false } },
        { $set: { allowAnyPayer: true } }
    );
    console.log('Patched trips (field missing):', result2.modifiedCount);

    process.exit(0);
}).catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
