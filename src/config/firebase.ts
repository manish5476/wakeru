import { initializeApp, cert, getApps, getApp, App } from 'firebase-admin/app';
import { logger } from './logger';

export let firebaseApp: App | undefined;

export const initializeFirebase = (): App => {
  try {
    if (getApps().length > 0) {
      firebaseApp = getApp();
      return firebaseApp;
    }
    // If FIREBASE_SERVICE_ACCOUNT_PATH is provided, use it.
    // Otherwise, Firebase admin will look for GOOGLE_APPLICATION_CREDENTIALS.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const path = require('path');
      const resolvedPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      const serviceAccount = require(resolvedPath);
      firebaseApp = initializeApp({
        credential: cert(serviceAccount)
      });
      logger.info('Firebase Admin initialized with service account file');
    } else {
      firebaseApp = initializeApp();
      logger.info('Firebase Admin initialized with application default credentials');
    }
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin', error);
    throw error;
  }
};
