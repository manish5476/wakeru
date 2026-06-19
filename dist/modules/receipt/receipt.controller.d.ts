import { Response, NextFunction } from 'express';
export declare class ReceiptController {
    uploadReceipt(req: any, res: Response, next: NextFunction): Promise<void>;
    getUserReceipts(req: any, res: Response, next: NextFunction): Promise<void>;
    getTripReceipts(req: any, res: Response, next: NextFunction): Promise<void>;
    getReceipt(req: any, res: Response, next: NextFunction): Promise<void>;
    updateReceipt(req: any, res: Response, next: NextFunction): Promise<void>;
    deleteReceipt(req: any, res: Response, next: NextFunction): Promise<void>;
    reprocessReceipt(req: any, res: Response, next: NextFunction): Promise<void>;
    convertToExpense(req: any, res: Response, next: NextFunction): Promise<void>;
}
export declare const receiptController: ReceiptController;
//# sourceMappingURL=receipt.controller.d.ts.map