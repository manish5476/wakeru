import { Router } from 'express';
import { locationController } from './location.controller';
import { protect } from '../auth/auth.middleware';
import { loadTrip, requireMember } from '../trips/trip.middleware';
import { tripIdParamSchema } from '../trips/trip.validators';
import { z } from 'zod';

const router = Router();
router.use(protect);
const validateTripLocation = (req: any, res: any, next: any) => {
  const result = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    maxDistanceKm: z.coerce.number().positive().max(500).optional(),
  }).safeParse(req.query);
  if (!result.success) return res.status(400).json({ success: false, error: 'Invalid location query parameters' });
  req.query = result.data;
  next();
};

// Get location info from GPS coordinates
router.get('/reverse-geocode', locationController.getLocationInfo);

// Search locations by text
router.get('/search', locationController.searchLocations);

// Get nearby stops for a trip
router.get('/nearby-stops/:tripId', validateTripLocation, loadTrip(), requireMember, locationController.checkNearbyStops);

// Smart stop suggestion
router.get('/suggest-stop/:tripId', validateTripLocation, loadTrip(), requireMember, locationController.suggestStop);

// Get supported countries
router.get('/countries', locationController.getSupportedCountries);

// Get currency info for a country
router.get('/currency/:countryCode', locationController.getCurrencyInfo);

export default router;
