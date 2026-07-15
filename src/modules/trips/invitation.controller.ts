// backend/src/modules/invitation/invitation.controller.ts

import { Request, Response } from 'express';
import { invitationService } from './invitation.service';
import { AppError } from '../../shared/errors/AppError';

// ✅ FIXED: Use firebaseUid — invitation service stores toUserId/fromUserId as Firebase UIDs
const getFirebaseUid = (req: Request): string => {
    const user = (req as any).user;
    if (!user?.firebaseUid) throw new AppError('Not authenticated', 401);
    return user.firebaseUid;
};

export const invitationController = {
    async getPendingInvitations(req: Request, res: Response): Promise<void> {
        try {
            const userId = getFirebaseUid(req); // ✅ Firebase UID
            const invitations = await invitationService.getPendingInvitations(userId);
            
            res.status(200).json({
                success: true,
                data: {
                    invitations,
                    count: invitations.length
                }
            });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ success: false, message: error.message });
            } else {
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        }
    },

    async getInvitationById(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = getFirebaseUid(req); // ✅ Firebase UID
            const invitation = await invitationService.getInvitationById(invitationId, userId);
            
            res.status(200).json({ success: true, data: { invitation } });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ success: false, message: error.message });
            } else {
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        }
    },

    async acceptInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = getFirebaseUid(req); // ✅ Firebase UID — compared against invitation.toUserId
            await invitationService.acceptInvitation(invitationId, userId);
            
            res.status(200).json({ success: true, message: 'Invitation accepted successfully' });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ success: false, message: error.message });
            } else {
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        }
    },

    async declineInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = getFirebaseUid(req); // ✅ Firebase UID
            await invitationService.declineInvitation(invitationId, userId);
            
            res.status(200).json({ success: true, message: 'Invitation declined successfully' });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ success: false, message: error.message });
            } else {
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        }
    },

    async sendInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { tripId, toUserId, message } = req.body;
            const fromUserId = getFirebaseUid(req); // ✅ Firebase UID — sender's Firebase UID
            const invitation = await invitationService.sendInvitation(
                tripId, 
                toUserId,   // toUserId from frontend — must be the target user's Firebase UID
                fromUserId, 
                message
            );
            
            res.status(201).json({
                success: true,
                data: { invitation },
                message: 'Invitation sent successfully'
            });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ success: false, message: error.message });
            } else {
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        }
    }
};