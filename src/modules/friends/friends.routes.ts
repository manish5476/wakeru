import { Router } from 'express';
import { friendsController } from './friends.controller';
import { protect } from '../../middleware/auth.middleware';
import { validate } from '../trips/trip.middleware';
import {
    sendFriendRequestSchema,
    friendRequestParamSchema,
    removeFriendParamSchema,
    searchUsersSchema,
} from './friends.validation';

const router = Router();
router.use(protect);

// Send friend request
router.post('/request', validate(sendFriendRequestSchema), friendsController.sendRequest);

// Accept friend request
router.post('/request/:requestId/accept', validate(friendRequestParamSchema, 'params'), friendsController.acceptRequest);

// Decline friend request
router.post('/request/:requestId/decline', validate(friendRequestParamSchema, 'params'), friendsController.declineRequest);

// Remove friend
router.delete('/:friendUserId', validate(removeFriendParamSchema, 'params'), friendsController.removeFriend);

// Get friends list
router.get('/', friendsController.getFriends);

// Get pending requests
router.get('/requests', friendsController.getPendingRequests);

// Search users
router.get('/search', validate(searchUsersSchema, 'query'), friendsController.searchUsers);

// Friend suggestions
router.get('/suggestions', friendsController.getSuggestions);

// Check friendship
router.get('/check/:friendUserId', friendsController.checkFriendship);

export default router;