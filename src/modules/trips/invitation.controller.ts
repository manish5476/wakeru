// backend/src/modules/invitation/invitation.controller.ts

import { Request, Response } from 'express';
import { invitationService } from './invitation.service';
import { AppError } from '../../shared/errors/AppError';

// Helper to extract authenticated user's ID (firebaseUid or userId or _id)
const getUserId = (req: Request): string => {
    const user = (req as any).user;
    const id = user?.firebaseUid || user?.userId || user?._id;
    if (!id) throw new AppError('Not authenticated', 401);
    return id.toString();
};

export const invitationController = {
    async getPendingInvitations(req: Request, res: Response): Promise<void> {
        try {
            const userId = getUserId(req);
            const invitations = await invitationService.getPendingInvitations(userId, (req as any).user);
            
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
            const userId = getUserId(req);
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
            const userId = getUserId(req);
            const trip = await invitationService.acceptInvitation(invitationId, userId);
            
            res.status(200).json({
                success: true,
                message: 'Invitation accepted successfully',
                data: {
                    trip,
                    tripId: trip?._id?.toString()
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

    async declineInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = getUserId(req);
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
            const fromUserId = getUserId(req);
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
    },

    async getSentInvitations(req: Request, res: Response): Promise<void> {
        try {
            const userId = getUserId(req);
            const invitations = await invitationService.getSentInvitations(userId, (req as any).user);
            
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

    async cancelInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = getUserId(req);
            await invitationService.cancelInvitation(invitationId, userId);
            
            res.status(200).json({ success: true, message: 'Invitation cancelled successfully' });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ success: false, message: error.message });
            } else {
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        }
    }
};