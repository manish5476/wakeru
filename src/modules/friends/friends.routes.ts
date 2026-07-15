import { Router } from 'express';
import { friendsController } from './friends.controller';
import { protect } from '../../middleware/auth.middleware';
import { validate } from '../trips/trip.middleware';
import {
    sendFriendRequestSchema,
    friendRequestParamSchema,
    removeFriendParamSchema,
    searchUsersSchema,
    inviteFriendsToTripSchema,
    respondToTripInviteSchema,
    muteFriendSchema,
} from './friends.validation';

const router = Router();
router.use(protect);

// Friend Requests
router.post('/request', validate(sendFriendRequestSchema), friendsController.sendRequest);
router.post('/request/:requestId/accept', validate(friendRequestParamSchema, 'params'), friendsController.acceptRequest);
router.post('/request/:requestId/decline', validate(friendRequestParamSchema, 'params'), friendsController.declineRequest);

// Friends Management
router.get('/', friendsController.getFriends);
router.get('/requests', friendsController.getPendingRequests);
router.get('/search', validate(searchUsersSchema, 'query'), friendsController.searchUsers);
router.get('/suggestions', friendsController.getSuggestions);
router.get('/check/:friendUserId', friendsController.checkFriendship);
router.delete('/:friendUserId', validate(removeFriendParamSchema, 'params'), friendsController.removeFriend);
router.post('/:friendUserId/block', validate(removeFriendParamSchema, 'params'), friendsController.blockFriend);
router.post('/:friendUserId/mute', validate(removeFriendParamSchema, 'params'), validate(muteFriendSchema), friendsController.muteFriend);

// 🚀 Trip Invites
router.post('/trip-invite', validate(inviteFriendsToTripSchema), friendsController.inviteFriendsToTrip);
router.post('/trip-invite/respond', validate(respondToTripInviteSchema), friendsController.respondToTripInvite);
router.get('/trip-invites', friendsController.getMyTripInvites);

export default router;