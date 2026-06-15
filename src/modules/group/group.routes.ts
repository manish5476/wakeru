import { Router } from 'express';
import { groupController } from './group.controller';
import { AuthMiddleware } from '../auth/auth.middleware';

const router = Router();

// All routes require authentication
router.use(AuthMiddleware.authenticate);

// Group CRUD
router.post('/', groupController.createGroup.bind(groupController));
router.get('/', groupController.getUserGroups.bind(groupController));
router.get('/search', groupController.searchGroups.bind(groupController));
router.get('/:groupId', groupController.getGroupById.bind(groupController));
router.put('/:groupId', groupController.updateGroup.bind(groupController));
router.post('/:groupId/archive', groupController.archiveGroup.bind(groupController));

// Member management
router.post('/:groupId/members', groupController.addMember.bind(groupController));
router.delete('/:groupId/members/:memberId', groupController.removeMember.bind(groupController));
router.put('/:groupId/members/:memberId/role', groupController.updateMemberRole.bind(groupController));

// Invite system
router.post('/join', groupController.joinByInviteCode.bind(groupController));

// Financial summary
router.get('/:groupId/financial-summary', groupController.getFinancialSummary.bind(groupController));

export default router;