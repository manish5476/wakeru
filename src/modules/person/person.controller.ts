import { Request, Response, NextFunction } from 'express';
import { personService } from './person.service';

export const personController = {
    async getPersonDetail(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUserId = (req as any).user.userId;
            const { userId } = req.params;
            const data = await personService.getPersonDetail(currentUserId, userId);
            res.status(200).json({ success: true, data });
        } catch (err) { next(err); }
    },
};