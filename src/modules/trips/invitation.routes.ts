// backend/src/modules/invitation/invitation.routes.ts

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
 * GET /api/v1/invitations/sent
 * Get all pending invitations sent by the current user.
 */
router.get('/sent', invitationController.getSentInvitations);

/**
 * POST /api/v1/invitations/send
 * Send an invitation to a user.
 */
router.post('/send', invitationController.sendInvitation);

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

/**
 * DELETE /api/v1/invitations/:invitationId
 * Cancel/revoke a pending invitation (by sender or admin).
 */
router.delete('/:invitationId', invitationController.cancelInvitation);
router.post('/:invitationId/cancel', invitationController.cancelInvitation);

export default router;