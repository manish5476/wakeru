import { Router } from 'express';
import { personController } from './person.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();
router.use(protect);

// ── LIGHTWEIGHT: Basic profile + balance (loads instantly) ──
router.get('/:userId/profile', personController.getPersonProfile);

// ── PAGINATED: Shared expenses ─────────────────────────────
router.get('/:userId/expenses', personController.getSharedExpenses);

// ── PAGINATED: Shared trips ────────────────────────────────
router.get('/:userId/trips', personController.getSharedTrips);

// ── LIMITED: Recent activity (last N items) ────────────────
router.get('/:userId/activity', personController.getRecentActivity);

// ── LIGHTWEIGHT: Settlement options only ───────────────────
router.get('/:userId/settlement', personController.getSettlementOptions);

// ── FULL (optional): Complete data for export/download ─────
router.get('/:userId/full', personController.getFullDetail);

export default router;
