"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const group_controller_1 = require("./group.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.AuthMiddleware.authenticate);
// Group CRUD
router.post('/', group_controller_1.groupController.createGroup.bind(group_controller_1.groupController));
router.get('/', group_controller_1.groupController.getUserGroups.bind(group_controller_1.groupController));
router.get('/search', group_controller_1.groupController.searchGroups.bind(group_controller_1.groupController));
router.get('/:groupId', group_controller_1.groupController.getGroupById.bind(group_controller_1.groupController));
router.put('/:groupId', group_controller_1.groupController.updateGroup.bind(group_controller_1.groupController));
router.post('/:groupId/archive', group_controller_1.groupController.archiveGroup.bind(group_controller_1.groupController));
// Member management
router.post('/:groupId/members', group_controller_1.groupController.addMember.bind(group_controller_1.groupController));
router.delete('/:groupId/members/:memberId', group_controller_1.groupController.removeMember.bind(group_controller_1.groupController));
router.put('/:groupId/members/:memberId/role', group_controller_1.groupController.updateMemberRole.bind(group_controller_1.groupController));
// Invite system
router.post('/join', group_controller_1.groupController.joinByInviteCode.bind(group_controller_1.groupController));
// Financial summary
router.get('/:groupId/financial-summary', group_controller_1.groupController.getFinancialSummary.bind(group_controller_1.groupController));
exports.default = router;
//# sourceMappingURL=group.routes.js.map