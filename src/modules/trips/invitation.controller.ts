// backend/src/modules/invitation/invitation.controller.ts

import { Request, Response } from 'express';
import { invitationService } from './invitation.service';
import { AppError } from '../../shared/errors/AppError';

export const invitationController = {
    async getPendingInvitations(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user.userId;
            const invitations = await invitationService.getPendingInvitations(userId);
            
            // ✅ Standardized response
            res.status(200).json({
                success: true,
                data: {
                    invitations,
                    count: invitations.length
                }
            });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ 
                    success: false, 
                    message: error.message 
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    message: 'Internal Server Error' 
                });
            }
        }
    },

    async getInvitationById(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = (req as any).user.userId;
            const invitation = await invitationService.getInvitationById(invitationId, userId);
            
            // ✅ Standardized response
            res.status(200).json({
                success: true,
                data: { invitation }
            });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ 
                    success: false, 
                    message: error.message 
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    message: 'Internal Server Error' 
                });
            }
        }
    },

    async acceptInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = (req as any).user.userId;
            await invitationService.acceptInvitation(invitationId, userId);
            
            // ✅ Standardized response
            res.status(200).json({ 
                success: true,
                message: 'Invitation accepted successfully' 
            });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ 
                    success: false, 
                    message: error.message 
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    message: 'Internal Server Error' 
                });
            }
        }
    },

    async declineInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = (req as any).user.userId;
            await invitationService.declineInvitation(invitationId, userId);
            
            // ✅ Standardized response
            res.status(200).json({ 
                success: true,
                message: 'Invitation declined successfully' 
            });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ 
                    success: false, 
                    message: error.message 
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    message: 'Internal Server Error' 
                });
            }
        }
    },

    // ✅ Add send invitation endpoint if not already in trip controller
    async sendInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { tripId, toUserId, message } = req.body;
            const fromUserId = (req as any).user.userId;
            const invitation = await invitationService.sendInvitation(
                tripId, 
                toUserId, 
                fromUserId, 
                message
            );
            
            // ✅ Standardized response
            res.status(201).json({
                success: true,
                data: { invitation },
                message: 'Invitation sent successfully'
            });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ 
                    success: false, 
                    message: error.message 
                });
            } else {
                res.status(500).json({ 
                    success: false, 
                    message: 'Internal Server Error' 
                });
            }
        }
    }
};