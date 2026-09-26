import { getAuth } from 'firebase-admin/auth';
import { firebaseApp } from '../../config/firebase';
import { config } from '../../config';

export type CustomAuthAction = 'verifyEmail' | 'resetPassword' | 'recoverEmail';

export interface CustomAuthActionLinkParams {
  email: string;
  action: CustomAuthAction;
}

/**
 * Generates a custom action link for email verification, password reset, etc.
 *
 * @param params The parameters for generating the link.
 * @returns A promise that resolves with the generated URL.
 */
export const generateCustomAuthActionLink = async (
  params: CustomAuthActionLinkParams,
): Promise<string> => {
  const { email, action } = params;

  const actionCodeSettings = {
    url: `${config.WEB_URL}/auth/action`, // URL to redirect back to
    handleCodeInApp: true,
  };

  const auth = firebaseApp ? getAuth(firebaseApp) : getAuth();

  switch (action) {
    case 'verifyEmail':
      return auth.generateEmailVerificationLink(email, actionCodeSettings);
    case 'resetPassword':
      return auth.generatePasswordResetLink(email, actionCodeSettings);
    default:
      // Potentially handle 'recoverEmail' or other actions here
      throw new Error(`Unsupported auth action: ${action}`);
  }
};
