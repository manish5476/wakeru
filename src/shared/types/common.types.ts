import { Request, ParamsDictionary } from 'express';
import { ParsedQs } from 'qs';

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId?: string;
}

// ============================================================
// AuthenticatedRequest
// ============================================================
//
// Extends Express's Request with all 4 generic type parameters
// explicitly passed through. This ensures req.params, req.body,
// req.query, and req.headers remain fully typed and accessible
// in all controllers — no TS2339 "Property does not exist" errors.
//
// Usage in controllers that need typed params/body:
//
//   type UpgradeRoleReq = AuthenticatedRequest<
//     { userId: string },           // req.params
//     any,                          // res.body
//     { role: string }              // req.body
//   >;
//
//   async upgradeRole(req: UpgradeRoleReq, res: Response, next: NextFunction) { ... }
//
// For generic controllers where you don't need strict typing, the
// default AuthenticatedRequest (with ParamsDictionary / any) is fine.

export interface AuthenticatedRequest<
  P = ParamsDictionary,       // req.params
  ResBody = any,              // res body
  ReqBody = any,              // req.body
  ReqQuery = ParsedQs,        // req.query
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: {
    userId:       string;
    email:        string;
    role:         string;
    displayName?: string;
    photoURL?:    string;
  };
  trip?:           any;   // Set by loadTrip middleware
  stop?:           any;   // Set by loadStop middleware
  idempotencyKey?: string;
  requestId?:      string;
}

export interface DateRange {
  startDate: Date;
  endDate:   Date;
}

export interface Location {
  type:         'Point';
  coordinates:  [number, number]; // [longitude, latitude]
  address?:     string;
}

export interface FileUpload {
  fieldname:    string;
  originalname: string;
  encoding:     string;
  mimetype:     string;
  buffer:       Buffer;
  size:         number;
}
// import { Request } from 'express';
// import { Types } from 'mongoose';

// export interface PaginationParams {
//   page?: number;
//   limit?: number;
//   sortBy?: string;
//   sortOrder?: 'asc' | 'desc';
// }

// export interface PaginatedResponse<T> {
//   data: T[];
//   pagination: {
//     page: number;
//     limit: number;
//     total: number;
//     totalPages: number;
//     hasNext: boolean;
//     hasPrev: boolean;
//   };
// }

// export interface ApiResponse<T = any> {
//   success: boolean;
//   message: string;
//   data?: T;
//   error?: {
//     code: string;
//     message: string;
//     details?: any;
//   };
//   timestamp: string;
//   requestId?: string;
// }

// // ✅ FIXED: Clean interface without index signatures
// export interface AuthenticatedRequest extends Request {
//   user?: {
//     userId: string;
//     email: string;
//     role: string;
//     displayName?: string;
//     photoURL?: string;
//   };
//   trip?: any;           // Set by loadTrip middleware
//   stop?: any;           // Set by loadStop middleware
//   idempotencyKey?: string;
//   requestId?: string;
// }

// export interface DateRange {
//   startDate: Date;
//   endDate: Date;
// }

// export interface Location {
//   type: 'Point';
//   coordinates: [number, number]; // [longitude, latitude]
//   address?: string;
// }

// export interface FileUpload {
//   fieldname: string;
//   originalname: string;
//   encoding: string;
//   mimetype: string;
//   buffer: Buffer;
//   size: number;
// }