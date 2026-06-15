import { Router } from 'express';
import { receiptController } from './receipt.controller';
import { AuthMiddleware } from '../auth/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

router.use(AuthMiddleware.authenticate);

// Receipt CRUD
router.post('/upload', upload.single('receipt'), receiptController.uploadReceipt.bind(receiptController));
router.get('/', receiptController.getUserReceipts.bind(receiptController));
router.get('/:receiptId', receiptController.getReceipt.bind(receiptController));
router.put('/:receiptId', receiptController.updateReceipt.bind(receiptController));
router.delete('/:receiptId', receiptController.deleteReceipt.bind(receiptController));

// OCR operations
router.post('/:receiptId/reprocess', receiptController.reprocessReceipt.bind(receiptController));
router.post('/:receiptId/convert', receiptController.convertToExpense.bind(receiptController));

export default router;