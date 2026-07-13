import { Router } from 'express';
import { protect } from '../../middleware/auth.middleware';
import { invitationController } from './invitation.controller';

const router = Router();

router.use(protect);

// ============================================================
// INVITATION ROUTES
// ============================================================

/**
 * GET /api/v1/invitations/pending
 * Get all pending invitations for the current user.
 */
router.get('/pending', invitationController.getPendingInvitations);

/**
 * GET /api/v1/invitations/:invitationId
 * Get a single invitation by its ID.
 */
router.get('/:invitationId', invitationController.getInvitationById);

/**
 * POST /api/v1/invitations/:invitationId/accept
 * Accept an invitation.
 */
router.post('/:invitationId/accept', invitationController.acceptInvitation);

/**
 * POST /api/v1/invitations/:invitationId/decline
 * Decline an invitation.
 */
router.post('/:invitationId/decline', invitationController.declineInvitation);

export default router;
