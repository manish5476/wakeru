import { Request, Response, NextFunction } from 'express';
import { locationService } from './location.service';
import { AppError } from '../../shared/errors/AppError';

const getUser = (req: Request) => {
    const user = (req as any).user;
    if (!user?.userId) throw new AppError('Not authenticated', 401);
    return user.userId;
};

export const locationController = {

    /** GET /api/v1/location/reverse-geocode?lat=12.34&lng=56.78 */
    async getLocationInfo(req: Request, res: Response, next: NextFunction) {
        try {
            const { lat, lng } = req.query;
            if (!lat || !lng) throw new AppError('lat and lng are required', 400);

            const data = await locationService.getLocationInfo(
                parseFloat(lat as string),
                parseFloat(lng as string)
            );
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/location/search?q=dubai */
    async searchLocations(req: Request, res: Response, next: NextFunction) {
        try {
            const { q } = req.query;
            if (!q) throw new AppError('Search query is required', 400);

            const data = await locationService.searchLocations(q as string);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/location/nearby-stops/:tripId?lat=12.34&lng=56.78 */
    async checkNearbyStops(req: Request, res: Response, next: NextFunction) {
        try {
            const { tripId } = req.params;
            const { lat, lng } = req.query;
            if (!lat || !lng) throw new AppError('lat and lng are required', 400);

            const data = await locationService.checkNearbyStops(
                tripId,
                parseFloat(lat as string),
                parseFloat(lng as string)
            );
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/location/suggest-stop/:tripId?lat=12.34&lng=56.78 */
    async suggestStop(req: Request, res: Response, next: NextFunction) {
        try {
            const { tripId } = req.params;
            const { lat, lng } = req.query;
            if (!lat || !lng) throw new AppError('lat and lng are required', 400);

            const data = await locationService.suggestStop(
                tripId,
                parseFloat(lat as string),
                parseFloat(lng as string)
            );
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/location/countries */
    async getSupportedCountries(req: Request, res: Response, next: NextFunction) {
        try {
            const data = locationService.getSupportedCountries();
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/location/currency/:countryCode */
    async getCurrencyInfo(req: Request, res: Response, next: NextFunction) {
        try {
            const { countryCode } = req.params;
            const data = locationService.getCurrencyInfo(countryCode);
            if (!data) throw new AppError('Country not found', 404);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },
};