import { Router } from 'express';
import { receiptController } from './receipt.controller';
import { protect } from '../auth/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

// All routes require authentication
router.use(protect);

// Upload
router.post(
  '/upload',
  upload.single('receipt'),
  receiptController.uploadReceipt.bind(receiptController)
);

// User's receipts
router.get('/', receiptController.getUserReceipts.bind(receiptController));

// Trip receipts
router.get('/trip/:tripId', receiptController.getTripReceipts.bind(receiptController));

// Single receipt CRUD
router.get('/:receiptId', receiptController.getReceipt.bind(receiptController));
router.put('/:receiptId', receiptController.updateReceipt.bind(receiptController));
router.delete('/:receiptId', receiptController.deleteReceipt.bind(receiptController));

// OCR operations
router.post('/:receiptId/reprocess', receiptController.reprocessReceipt.bind(receiptController));
router.post('/:receiptId/convert', receiptController.convertToExpense.bind(receiptController));

export default router;