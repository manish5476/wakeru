import { Request } from 'express';
import { Types } from 'mongoose';

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

// ✅ FIXED: Clean interface without index signatures
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;       // UUID _id — used by auth middleware internally
    firebaseUid: string;  // Firebase UID — used by friends/notifications/trips services
    email: string;
    role: string;
    displayName?: string;
    photoURL?: string;
  };
  trip?: any;           // Set by loadTrip middleware
  stop?: any;           // Set by loadStop middleware
  idempotencyKey?: string;
  requestId?: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface Location {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
}

export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}