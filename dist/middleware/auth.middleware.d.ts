import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types/common.types';
export declare const protect: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map