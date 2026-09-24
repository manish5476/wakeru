import { Router } from 'express';
import { ledgerController } from './ledger.controller';
import { protect } from '../../middleware/auth.middleware';

const router = Router();

router.use(protect);

router.get('/balances', ledgerController.getBalances);
router.get('/breakdown', ledgerController.getBreakdown);

export default router;
