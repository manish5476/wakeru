import { z } from 'zod';

export const verifyFirebaseTokenSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
  metadata: z.object({
    displayName: z.string().min(1).max(100).optional(),
    phoneNumber: z.string().optional(),
  }).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required to log out'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});
