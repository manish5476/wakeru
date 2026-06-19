import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

// Import controller methods (inline to avoid circular deps)
import { invitationService } from './invitation.service';

// ============================================================
// INVITATION ROUTES
// ============================================================

/**
 * GET /api/v1/invitations/pending
 * Get all pending invitations for the current user.
 */
router.get('/pending', async (req, res, next) => {
    try {
        const userId = (req as any).user.userId;
        const invitations = await invitationService.getPendingInvitations(userId);
        res.status(200).json({ success: true, data: { invitations } });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/invitations/send
 * Send an invitation to a user.
 * Body: { tripId, toUserId, message? }
 */
router.post('/send', async (req, res, next) => {
    try {
        const userId = (req as any).user.userId;
        const { tripId, toUserId, message } = req.body;
        const invitation = await invitationService.sendInvitation(tripId, toUserId, userId, message);
        res.status(201).json({ success: true, message: 'Invitation sent', data: { invitation } });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/invitations/:invitationId/accept
 * Accept an invitation.
 */
router.post('/:invitationId/accept', async (req, res, next) => {
    try {
        const userId = (req as any).user.userId;
        await invitationService.acceptInvitation(req.params.invitationId, userId);
        res.status(200).json({ success: true, message: 'Invitation accepted — you have joined the trip!' });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/v1/invitations/:invitationId/decline
 * Decline an invitation.
 */
router.post('/:invitationId/decline', async (req, res, next) => {
    try {
        const userId = (req as any).user.userId;
        await invitationService.declineInvitation(req.params.invitationId, userId);
        res.status(200).json({ success: true, message: 'Invitation declined' });
    } catch (err) {
        next(err);
    }
});

export default router;