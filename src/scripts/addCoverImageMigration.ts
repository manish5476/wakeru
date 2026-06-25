
import mongoose from 'mongoose';
import { Trip } from '../modules/trips/trip.model'; // Adjust the import path if necessary
import { connectDB } from '../config/database'; // Adjust the import path if necessary

const defaultTripCoverImage = 'https://i.pinimg.com/1200x/3b/3c/86/3b3c86d3cef87a6797c96c07f3dc0124.jpg';
const defaultStopCoverImage = 'https://i.pinimg.com/736x/68/11/6b/68116be5b8fcd754b7f811625bd51223.jpg';

const migrateCoverImages = async () => {
  try {
    // 1. Connect to the database
    await connectDB();
    console.log('Database connected.');

    // 2. Update all Trips that are missing a coverImage
    const tripUpdateResult = await Trip.updateMany(
      { coverImage: { $exists: false } },
      { $set: { coverImage: defaultTripCoverImage } }
    );
    console.log(`Trips updated: ${tripUpdateResult.modifiedCount} document(s)`);

    // 3. Update all Stops within Trips that are missing a coverImage
    // We use arrayFilters to target only the stops that need updating.
    const stopUpdateResult = await Trip.updateMany(
      { 'stops.coverImage': { $exists: false } },
      { $set: { 'stops.$[elem].coverImage': defaultStopCoverImage } },
      { arrayFilters: [{ 'elem.coverImage': { $exists: false } }] }
    );
    console.log(`Stops updated within ${stopUpdateResult.modifiedCount} trip document(s).`);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // 4. Close the database connection
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
};

// Run the migration
migrateCoverImages();

