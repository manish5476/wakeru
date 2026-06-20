import { Request, Response, NextFunction } from 'express';
import { reminderService } from './reminder.service';

const getUser = (req: Request) => {
    const user = (req as any).user;
    if (!user?.userId) throw new Error('Not authenticated');
    return user.userId;
};

export const remindersController = {
    /** POST /api/v1/reminders */
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminder = await reminderService.create(userId, req.body);
            res.status(201).json({ success: true, message: 'Reminder created', data: { reminder } });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/reminders */
    async getMyReminders(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const status = req.query.status as string | undefined;
            const reminders = await reminderService.getUserReminders(userId, status);
            res.status(200).json({ success: true, data: { reminders } });
        } catch (err) { next(err); }
    },

    /** PATCH /api/v1/reminders/:reminderId/pause */
    async pause(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminder = await reminderService.pause(req.params.reminderId, userId);
            res.status(200).json({ success: true, message: 'Reminder paused', data: { reminder } });
        } catch (err) { next(err); }
    },

    /** PATCH /api/v1/reminders/:reminderId/resume */
    async resume(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const reminder = await reminderService.resume(req.params.reminderId, userId);
            res.status(200).json({ success: true, message: 'Reminder resumed', data: { reminder } });
        } catch (err) { next(err); }
    },

    /** DELETE /api/v1/reminders/:reminderId */
    async cancel(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            await reminderService.cancel(req.params.reminderId, userId);
            res.status(200).json({ success: true, message: 'Reminder cancelled' });
        } catch (err) { next(err); }
    },
};