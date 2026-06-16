import { initializeApp, cert } from 'firebase-admin/app';
import { logger } from './logger';

export const initializeFirebase = () => {
  try {
    // If FIREBASE_SERVICE_ACCOUNT_PATH is provided, use it.
    // Otherwise, Firebase admin will look for GOOGLE_APPLICATION_CREDENTIALS.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const path = require('path');
      const resolvedPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      const serviceAccount = require(resolvedPath);
      initializeApp({
        credential: cert(serviceAccount)
      });
      logger.info('Firebase Admin initialized with service account file');
    } else {
      initializeApp();
      logger.info('Firebase Admin initialized with application default credentials');
    }
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin', error);
  }
};
