"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Placeholder route - get all notifications
router.get('/', (req, res) => {
    res.status(200).json({ message: 'Fetched all notifications' });
});
// Placeholder route - mark a notification as read
router.patch('/:id/read', (req, res) => {
    res.status(200).json({ message: `Notification ${req.params.id} marked as read` });
});
exports.default = router;
//# sourceMappingURL=notification.routes.js.map