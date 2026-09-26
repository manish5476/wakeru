import { UserRecord } from 'firebase-admin/auth';
import { config } from '../../config';
import { emailProvider } from './email.provider';
import { generatePasswordResetTemplate, generateVerificationEmailTemplate } from './email.templates';
import { CustomAuthActionLinkParams, generateCustomAuthActionLink } from './firebase.utils';


/**
 * Sends a password reset email to the user with a secure Firebase link.
 *
 * @param user The user to send the password reset email to.
 */
export const sendPasswordResetEmail = async (user: UserRecord): Promise<void> => {
  const linkParams: CustomAuthActionLinkParams = {
    email: user.email!,
    action: 'resetPassword',
  };
  const actionUrl = await generateCustomAuthActionLink(linkParams);

  const { subject, html, text } = generatePasswordResetTemplate({
    displayName: user.displayName || 'Wareku User',
    actionUrl,
  });

  await emailProvider.sendEmail({
    to: user.email!,
    subject,
    html,
    text,
  });
};

/**
 * Sends a verification email to the user with a secure Firebase link.
 *
 * @param user The user to send the verification email to.
 */
export const sendVerificationEmail = async (user: UserRecord): Promise<void> => {
  const linkParams: CustomAuthActionLinkParams = {
    email: user.email!,
    action: 'verifyEmail',
  };
  const actionUrl = await generateCustomAuthActionLink(linkParams);

  const { subject, html, text } = generateVerificationEmailTemplate({
    displayName: user.displayName || 'Wareku User',
    actionUrl,
  });

  await emailProvider.sendEmail({
    to: user.email!,
    subject,
    html,
    text,
  });
};
