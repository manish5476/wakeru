import { Request, Response, NextFunction } from 'express';
import { friendsService } from './friends.service';

const getUser = (req: Request) => {
    const user = (req as any).user;
    if (!user?.userId) throw new Error('Not authenticated');
    return user.userId;
};

export const friendsController = {
    /** POST /api/v1/friends/request */
    async sendRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { toUserId, message } = req.body;
            const request = await friendsService.sendRequest(userId, toUserId, message);
            res.status(201).json({ success: true, message: 'Friend request sent', data: { request } });
        } catch (err) { next(err); }
    },

    /** POST /api/v1/friends/request/:requestId/accept */
    async acceptRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            await friendsService.acceptRequest(req.params.requestId, userId);
            res.status(200).json({ success: true, message: 'Friend request accepted' });
        } catch (err) { next(err); }
    },

    /** POST /api/v1/friends/request/:requestId/decline */
    async declineRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            await friendsService.declineRequest(req.params.requestId, userId);
            res.status(200).json({ success: true, message: 'Friend request declined' });
        } catch (err) { next(err); }
    },

    /** DELETE /api/v1/friends/:friendUserId */
    async removeFriend(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            await friendsService.removeFriend(userId, req.params.friendUserId);
            res.status(200).json({ success: true, message: 'Friend removed' });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/friends */
    async getFriends(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const search = req.query.search as string | undefined;
            const friends = await friendsService.getFriends(userId, search);
            res.status(200).json({ success: true, data: { friends } });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/friends/requests */
    async getPendingRequests(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const requests = await friendsService.getPendingRequests(userId);
            res.status(200).json({ success: true, data: { requests } });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/friends/search?query=... */
    async searchUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const query = req.query.query as string;
            const users = await friendsService.searchUsers(userId, query);
            res.status(200).json({ success: true, data: { users } });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/friends/suggestions */
    async getSuggestions(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const suggestions = await friendsService.getSuggestions(userId);
            res.status(200).json({ success: true, data: { suggestions } });
        } catch (err) { next(err); }
    },

    /** GET /api/v1/friends/check/:friendUserId */
    async checkFriendship(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const areFriends = await friendsService.areFriends(userId, req.params.friendUserId);
            res.status(200).json({ success: true, data: { areFriends } });
        } catch (err) { next(err); }
    },
};