import { Request, Response, NextFunction } from 'express';
import { friendsService } from './friends.service';
import { AppError } from '../../shared/errors/AppError';

const getUser = (req: Request) => {
    const user = (req as any).user;
    if (!user?.userId) throw new AppError('Not authenticated', 401);
    return user.userId;
};

export const friendsController = {
    // Friend Requests
    async sendRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { toUserId, message } = req.body;
            const request = await friendsService.sendRequest(userId, toUserId, message);
            res.status(201).json({ success: true, message: 'Friend request sent', data: { request } });
        } catch (err) { next(err); }
    },

    async acceptRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            await friendsService.acceptRequest(req.params.requestId, userId);
            res.status(200).json({ success: true, message: 'Friend request accepted' });
        } catch (err) { next(err); }
    },

    async declineRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            await friendsService.declineRequest(req.params.requestId, userId);
            res.status(200).json({ success: true, message: 'Friend request declined' });
        } catch (err) { next(err); }
    },

    async removeFriend(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            await friendsService.removeFriend(userId, req.params.friendUserId);
            res.status(200).json({ success: true, message: 'Friend removed' });
        } catch (err) { next(err); }
    },

    async blockFriend(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            await friendsService.blockFriend(userId, req.params.friendUserId);
            res.status(200).json({ success: true, message: 'Friend blocked' });
        } catch (err) { next(err); }
    },

    async muteFriend(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { mute } = req.body;
            await friendsService.muteFriend(userId, req.params.friendUserId, mute ?? true);
            res.status(200).json({ success: true, message: mute === false ? 'Friend unmuted' : 'Friend muted' });
        } catch (err) { next(err); }
    },

    // Friends List
    async getFriends(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const search = req.query.search as string | undefined;
            const friends = await friendsService.getFriends(userId, search);
            res.status(200).json({ success: true, data: { friends, count: friends.length } });
        } catch (err) { next(err); }
    },

    async getPendingRequests(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const requests = await friendsService.getPendingRequests(userId);
            res.status(200).json({ success: true, data: { requests, count: requests.length } });
        } catch (err) { next(err); }
    },

    async searchUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const query = req.query.query as string;
            const users = await friendsService.searchUsers(userId, query);
            res.status(200).json({ success: true, data: { users } });
        } catch (err) { next(err); }
    },

    async getSuggestions(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const suggestions = await friendsService.getSuggestions(userId);
            res.status(200).json({ success: true, data: { suggestions } });
        } catch (err) { next(err); }
    },

    async checkFriendship(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const areFriends = await friendsService.areFriends(userId, req.params.friendUserId);
            res.status(200).json({ success: true, data: { areFriends } });
        } catch (err) { next(err); }
    },

    // 🚀 TRIP INVITES
    async inviteFriendsToTrip(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { tripId, friendUids, message } = req.body;
            await friendsService.inviteFriendsToTrip(tripId, userId, friendUids, message);
            res.status(200).json({
                success: true,
                message: `Trip invite sent to ${friendUids.length} friends`,
            });
        } catch (err) { next(err); }
    },

    async respondToTripInvite(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const { tripId, response, inviterUid } = req.body;
            await friendsService.respondToTripInvite(tripId, userId, response, inviterUid);
            res.status(200).json({ success: true, message: `Response recorded: ${response}` });
        } catch (err) { next(err); }
    },

    async getMyTripInvites(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = getUser(req);
            const invites = await friendsService.getMyTripInvites(userId);
            res.status(200).json({ success: true, data: { invites, count: invites.length } });
        } catch (err) { next(err); }
    },
};


// import { Request, Response, NextFunction } from 'express';
// import { friendsService } from './friends.service';

// const getUser = (req: Request) => {
//     const user = (req as any).user;
//     if (!user?.userId) throw new Error('Not authenticated');
//     return user.userId;
// };

// export const friendsController = {
//     /** POST /api/v1/friends/request */
//     async sendRequest(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const { toUserId, message } = req.body;
//             const request = await friendsService.sendRequest(userId, toUserId, message);
//             res.status(201).json({ success: true, message: 'Friend request sent', data: { request } });
//         } catch (err) { next(err); }
//     },

//     /** POST /api/v1/friends/request/:requestId/accept */
//     async acceptRequest(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             await friendsService.acceptRequest(req.params.requestId, userId);
//             res.status(200).json({ success: true, message: 'Friend request accepted' });
//         } catch (err) { next(err); }
//     },

//     /** POST /api/v1/friends/request/:requestId/decline */
//     async declineRequest(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             await friendsService.declineRequest(req.params.requestId, userId);
//             res.status(200).json({ success: true, message: 'Friend request declined' });
//         } catch (err) { next(err); }
//     },

//     /** DELETE /api/v1/friends/:friendUserId */
//     async removeFriend(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             await friendsService.removeFriend(userId, req.params.friendUserId);
//             res.status(200).json({ success: true, message: 'Friend removed' });
//         } catch (err) { next(err); }
//     },

//     /** GET /api/v1/friends */
//     async getFriends(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const search = req.query.search as string | undefined;
//             const friends = await friendsService.getFriends(userId, search);
//             res.status(200).json({ success: true, data: { friends } });
//         } catch (err) { next(err); }
//     },

//     /** GET /api/v1/friends/requests */
//     async getPendingRequests(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const requests = await friendsService.getPendingRequests(userId);
//             res.status(200).json({ success: true, data: { requests } });
//         } catch (err) { next(err); }
//     },

//     /** GET /api/v1/friends/search?query=... */
//     async searchUsers(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const query = req.query.query as string;
//             const users = await friendsService.searchUsers(userId, query);
//             res.status(200).json({ success: true, data: { users } });
//         } catch (err) { next(err); }
//     },

//     /** GET /api/v1/friends/suggestions */
//     async getSuggestions(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const suggestions = await friendsService.getSuggestions(userId);
//             res.status(200).json({ success: true, data: { suggestions } });
//         } catch (err) { next(err); }
//     },

//     /** GET /api/v1/friends/check/:friendUserId */
//     async checkFriendship(req: Request, res: Response, next: NextFunction) {
//         try {
//             const userId = getUser(req);
//             const areFriends = await friendsService.areFriends(userId, req.params.friendUserId);
//             res.status(200).json({ success: true, data: { areFriends } });
//         } catch (err) { next(err); }
//     },
// };