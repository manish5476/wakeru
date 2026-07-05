import { Router } from 'express';
import { locationController } from './location.controller';
import { protect } from '../auth/auth.middleware';

const router = Router();
router.use(protect);

// Get location info from GPS coordinates
router.get('/reverse-geocode', locationController.getLocationInfo);

// Search locations by text
router.get('/search', locationController.searchLocations);

// Get nearby stops for a trip
router.get('/nearby-stops/:tripId', locationController.checkNearbyStops);

// Smart stop suggestion
router.get('/suggest-stop/:tripId', locationController.suggestStop);

// Get supported countries
router.get('/countries', locationController.getSupportedCountries);

// Get currency info for a country
router.get('/currency/:countryCode', locationController.getCurrencyInfo);

export default router;