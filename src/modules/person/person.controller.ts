import { Request, Response, NextFunction } from 'express';
import { personService } from './person.service';
import { AppError } from '../../shared/errors/AppError';

const getUser = (req: Request) => {
    const user = (req as any).user;
    if (!user?.userId) throw new AppError('Not authenticated', 401);
    return user.userId;
};

export const personController = {

    /** GET /api/v1/person/:userId/profile */
    async getPersonProfile(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUserId = getUser(req);
            const { userId } = req.params;
            const data = await personService.getPersonProfile(currentUserId, userId);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/person/:userId/expenses?page=1&limit=20 */
    async getSharedExpenses(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUserId = getUser(req);
            const { userId } = req.params;
            const { page, limit, status, category, tripId, sortBy, sortOrder } = req.query;
            const data = await personService.getSharedExpenses(currentUserId, userId, {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 20,
                status: status as string,
                category: category as string,
                tripId: tripId as string,
                sortBy: sortBy as string,
                sortOrder: sortOrder as 'asc' | 'desc',
            });
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/person/:userId/trips?page=1&limit=10 */
    async getSharedTrips(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUserId = getUser(req);
            const { userId } = req.params;
            const { page, limit } = req.query;
            const data = await personService.getSharedTrips(currentUserId, userId, {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 10,
            });
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/person/:userId/activity?limit=10 */
    async getRecentActivity(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUserId = getUser(req);
            const { userId } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
            const data = await personService.getRecentActivity(currentUserId, userId, Math.min(limit, 50));
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/person/:userId/settlement */
    async getSettlementOptions(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUserId = getUser(req);
            const { userId } = req.params;
            const data = await personService.getSettlementOptions(currentUserId, userId);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/person/:userId/full */
    async getFullDetail(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUserId = getUser(req);
            const { userId } = req.params;
            const data = await personService.getFullDetail(currentUserId, userId);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },
};

