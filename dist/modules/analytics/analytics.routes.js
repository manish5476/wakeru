"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("./analytics.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.AuthMiddleware.authenticate);
// User analytics
router.get('/user', analytics_controller_1.analyticsController.getUserAnalytics.bind(analytics_controller_1.analyticsController));
// Trip analytics
router.get('/trip/:tripId', analytics_controller_1.analyticsController.getTripAnalytics.bind(analytics_controller_1.analyticsController));
router.get('/trip/:tripId/predictive', analytics_controller_1.analyticsController.getPredictiveAnalytics.bind(analytics_controller_1.analyticsController));
router.get('/trip/:tripId/report', analytics_controller_1.analyticsController.getSpendingReport.bind(analytics_controller_1.analyticsController));
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map