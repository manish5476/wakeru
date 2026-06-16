import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export declare class ReceiptController {
    uploadReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getUserReceipts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    updateReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    deleteReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    reprocessReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    convertToExpense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const receiptController: ReceiptController;
//# sourceMappingURL=receipt.controller.d.ts.map