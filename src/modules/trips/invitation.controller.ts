import { Request, Response } from 'express';
import { invitationService } from './invitation.service';
import { AppError } from '../../shared/errors/AppError';

export const invitationController = {
    async getPendingInvitations(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user.userId;
            const invitations = await invitationService.getPendingInvitations(userId);
            res.status(200).json(invitations);
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ message: error.message });
            } else {
                res.status(500).json({ message: 'Internal Server Error' });
            }
        }
    },

    async getInvitationById(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = (req as any).user.userId;
            const invitation = await invitationService.getInvitationById(invitationId, userId);
            res.status(200).json(invitation);
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ message: error.message });
            } else {
                res.status(500).json({ message: 'Internal Server Error' });
            }
        }
    },

    async acceptInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = (req as any).user.userId;
            await invitationService.acceptInvitation(invitationId, userId);
            res.status(200).json({ message: 'Invitation accepted successfully' });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ message: error.message });
            } else {
                res.status(500).json({ message: 'Internal Server Error' });
            }
        }
    },

    async declineInvitation(req: Request, res: Response): Promise<void> {
        try {
            const { invitationId } = req.params;
            const userId = (req as any).user.userId;
            await invitationService.declineInvitation(invitationId, userId);
            res.status(200).json({ message: 'Invitation declined successfully' });
        } catch (error) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ message: error.message });
            } else {
                res.status(500).json({ message: 'Internal Server Error' });
            }
        }
    }
};
