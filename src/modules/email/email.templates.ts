// src/modules/email/email.templates.ts
// Ultra-Professional, Apple & Google Tier Transactional Email Templates
// Features high-DPI branding, responsive typography, and security disclosures

import { config } from '../../config';

const BRAND_NAME = 'TripSplit';
const SUPPORT_EMAIL = config.EMAIL_REPLY_TO || 'tripSplit@proton.me';
const WEB_URL = config.WEB_URL || 'https://www.wakeru.net';
const LOGO_URL = `${WEB_URL}/apple-touch-icon.png`;

interface BaseEmailLayoutProps {
  preheader: string;
  badgeText: string;
  badgeColor?: string;
  badgeBg?: string;
  headline: string;
  recipientName: string;
  messageLines: string[];
  cta?: {
    label: string;
    url: string;
  };
  securityTip?: string;
  warningNote?: string;
}

/**
 * Master Responsive HTML Email Builder
 * Engineered to render pixel-perfect across Apple Mail, Gmail (Web, iOS, Android), and Outlook.
 */
function buildMasterEmailHtml(props: BaseEmailLayoutProps): string {
  const currentYear = new Date().getFullYear();
  const badgeColor = props.badgeColor || '#2563EB';
  const badgeBg = props.badgeBg || '#EFF6FF';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${props.headline}</title>
  <style>
    /* Reset & Base Styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      line-height: 1.6;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    /* Mobile Responsive */
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        margin: auto !important;
        border-radius: 0 !important;
        border: none !important;
      }
      .content-padding {
        padding: 32px 24px !important;
      }
      .headline-text {
        font-size: 22px !important;
        line-height: 28px !important;
      }
      .cta-button {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC;">
  <!-- Preheader text for inbox preview -->
  <div style="display: none; font-size: 1px; color: #F8FAFC; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${props.preheader}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table class="email-container" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; width: 100%; background-color: #FFFFFF; border-radius: 20px; border: 1px solid #E2E8F0; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05); overflow: hidden;">
          
          <!-- Brand Header -->
          <tr>
            <td align="center" style="padding: 36px 40px 20px 40px; border-bottom: 1px solid #F1F5F9;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="${LOGO_URL}" width="42" height="42" alt="${BRAND_NAME}" style="display: block; border-radius: 10px; width: 42px; height: 42px;" />
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px; text-align: left;">
                    <div style="font-size: 22px; font-weight: 800; color: #0F172A; letter-spacing: -0.6px; line-height: 24px;">
                      Trip<span style="color: #2563EB;">Split</span>
                    </div>
                    <div style="font-size: 10px; font-weight: 700; color: #64748B; letter-spacing: 0.6px; text-transform: uppercase; margin-top: 2px;">
                      Group Travel & Expense OS
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="content-padding" style="padding: 36px 44px;">
              <!-- Context Badge -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background-color: ${badgeBg}; padding: 4px 12px; border-radius: 9999px; border: 1px solid ${badgeColor}25;">
                    <span style="font-size: 11px; font-weight: 700; color: ${badgeColor}; text-transform: uppercase; letter-spacing: 0.6px;">
                      ${props.badgeText}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Headline -->
              <h1 class="headline-text" style="margin: 0 0 16px 0; font-size: 26px; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; line-height: 34px;">
                ${props.headline}
              </h1>

              <!-- Greeting -->
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 24px;">
                Hello <strong>${props.recipientName}</strong>,
              </p>

              <!-- Body Paragraphs -->
              ${props.messageLines
                .map(
                  (line) =>
                    `<p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 24px;">${line}</p>`
                )
                .join('')}

              <!-- Primary CTA Button (if present) -->
              ${
                props.cta
                  ? `
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 9999px; background-color: #2563EB;">
                    <a href="${props.cta.url}" target="_blank" class="cta-button" style="display: inline-block; background-color: #2563EB; background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 9999px; letter-spacing: 0.2px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
                      ${props.cta.label} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alternative Link Box -->
              <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 16px; margin: 24px 0 20px 0;">
                <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748B;">
                  Button not displaying properly? Copy and paste this URL into your browser:
                </p>
                <div style="font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 12px; color: #2563EB; word-break: break-all; line-height: 18px;">
                  <a href="${props.cta.url}" target="_blank" style="color: #2563EB; text-decoration: underline;">${props.cta.url}</a>
                </div>
              </div>
              `
                  : ''
              }

              <!-- Security Tip Notice -->
              ${
                props.securityTip
                  ? `
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px; background-color: #F1F5F9; border-radius: 12px; padding: 14px 16px;">
                <tr>
                  <td style="font-size: 13px; color: #475569; line-height: 20px;">
                    <strong style="color: #0F172A;">Security Tip:</strong> ${props.securityTip}
                  </td>
                </tr>
              </table>
              `
                  : ''
              }

              <!-- Warning / Ignore Note -->
              ${
                props.warningNote
                  ? `
              <p style="margin: 20px 0 0 0; font-size: 13px; color: #94A3B8; line-height: 20px;">
                ${props.warningNote}
              </p>
              `
                  : ''
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 28px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #475569;">
                Need help or have questions? Contact us at 
                <a href="mailto:${SUPPORT_EMAIL}" style="color: #2563EB; text-decoration: none; font-weight: 700;">${SUPPORT_EMAIL}</a>
              </p>
              
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #94A3B8;">
                <a href="${WEB_URL}" target="_blank" style="color: #64748B; text-decoration: none; margin: 0 6px;">Website</a> &bull;
                <a href="${WEB_URL}/faq" target="_blank" style="color: #64748B; text-decoration: none; margin: 0 6px;">FAQ</a> &bull;
                <a href="${WEB_URL}/privacy-policy" target="_blank" style="color: #64748B; text-decoration: none; margin: 0 6px;">Privacy</a> &bull;
                <a href="${WEB_URL}/terms" target="_blank" style="color: #64748B; text-decoration: none; margin: 0 6px;">Terms</a>
              </p>

              <p style="margin: 0; font-size: 11px; color: #94A3B8; line-height: 16px;">
                &copy; ${currentYear} TripSplit Inc. All rights reserved.<br>
                This automated message was sent regarding your TripSplit account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// 1. Email Verification Template
// ─────────────────────────────────────────────────────────────
interface VerificationEmailProps {
  displayName: string;
  actionUrl: string;
}

export const generateVerificationEmailTemplate = (props: VerificationEmailProps) => {
  const { displayName, actionUrl } = props;

  const subject = `Verify your ${BRAND_NAME} account`;

  const html = buildMasterEmailHtml({
    preheader: `Welcome to ${BRAND_NAME}! Confirm your email address to start splitting group travel expenses.`,
    badgeText: 'Account Verification',
    badgeColor: '#2563EB',
    badgeBg: '#EFF6FF',
    headline: 'Confirm your email address',
    recipientName: displayName || 'Traveler',
    messageLines: [
      `Welcome to <strong>${BRAND_NAME}</strong> &mdash; the modern operating system for group travel expenses and shared budgets.`,
      `To finish securing your account and start organizing trips with friends, please verify your email address by tapping the button below.`,
    ],
    cta: {
      label: 'Verify Email Address',
      url: actionUrl,
    },
    securityTip:
      'This verification link is unique to you and will safely expire after use.',
    warningNote:
      `If you did not sign up for a ${BRAND_NAME} account, no action is needed and you can safely disregard this email.`,
  });

  const text = `
Hello ${displayName || 'Traveler'},

Welcome to ${BRAND_NAME}!

Please verify your email address to finish setting up your account by opening the following secure link in your browser:

${actionUrl}

This link is unique to your account and will expire after use.

If you didn't create a ${BRAND_NAME} account, you can safely ignore this email.

Support: ${SUPPORT_EMAIL}
© ${new Date().getFullYear()} ${BRAND_NAME} Inc.
`;

  return { subject, html, text };
};

// ─────────────────────────────────────────────────────────────
// 2. Password Reset Template
// ─────────────────────────────────────────────────────────────
interface PasswordResetEmailProps {
  displayName: string;
  actionUrl: string;
}

export const generatePasswordResetTemplate = (props: PasswordResetEmailProps) => {
  const { displayName, actionUrl } = props;

  const subject = `Reset your ${BRAND_NAME} password`;

  const html = buildMasterEmailHtml({
    preheader: `A password reset was requested for your ${BRAND_NAME} account.`,
    badgeText: 'Security Notice',
    badgeColor: '#D97706',
    badgeBg: '#FEF3C7',
    headline: 'Reset your password',
    recipientName: displayName || 'Traveler',
    messageLines: [
      `We received a request to reset the password for your ${BRAND_NAME} account.`,
      `To choose a new secure password, please click the button below. For your protection, this link is valid for <strong>1 hour</strong>.`,
    ],
    cta: {
      label: 'Reset My Password',
      url: actionUrl,
    },
    securityTip:
      `${BRAND_NAME} engineers will never ask you for your password or payment credentials via email.`,
    warningNote:
      `If you did not request a password reset, your account is safe. Please ignore this email or reach out to ${SUPPORT_EMAIL} if you suspect unauthorized activity.`,
  });

  const text = `
Hello ${displayName || 'Traveler'},

We received a request to reset the password for your ${BRAND_NAME} account.

Use the link below to set a new password. This link is valid for 1 hour:

${actionUrl}

If you did not request this password reset, please ignore this email or contact support at ${SUPPORT_EMAIL}.

Support: ${SUPPORT_EMAIL}
© ${new Date().getFullYear()} ${BRAND_NAME} Inc.
`;

  return { subject, html, text };
};

// ─────────────────────────────────────────────────────────────
// 3. Email Changed Notification Template
// ─────────────────────────────────────────────────────────────
interface EmailChangedProps {
  displayName: string;
  newEmail: string;
}

export const generateEmailChangedTemplate = (props: EmailChangedProps) => {
  const { displayName, newEmail } = props;

  const subject = `Security Alert: Email address changed on your ${BRAND_NAME} account`;

  const html = buildMasterEmailHtml({
    preheader: `The email address associated with your ${BRAND_NAME} account has been updated.`,
    badgeText: 'Account Update',
    badgeColor: '#EF4444',
    badgeBg: '#FEE2E2',
    headline: 'Your account email was changed',
    recipientName: displayName || 'Traveler',
    messageLines: [
      `This is an automated confirmation that the email address associated with your ${BRAND_NAME} account has been successfully changed to <strong>${newEmail}</strong>.`,
      `If you performed this change, no further action is necessary.`,
    ],
    securityTip:
      `If you did NOT authorize this change, your account may be compromised. Please contact our security response team immediately at ${SUPPORT_EMAIL}.`,
    warningNote:
      `For your security, active sessions on unrecognized devices have been invalidated.`,
  });

  const text = `
Hello ${displayName || 'Traveler'},

This is a security confirmation that the email address for your ${BRAND_NAME} account was changed to ${newEmail}.

If you did not make this change, please contact our support team immediately at ${SUPPORT_EMAIL}.

Support: ${SUPPORT_EMAIL}
© ${new Date().getFullYear()} ${BRAND_NAME} Inc.
`;

  return { subject, html, text };
};

// ─────────────────────────────────────────────────────────────
// 4. MFA / Security Notification Template
// ─────────────────────────────────────────────────────────────
interface MfaNotificationProps {
  displayName: string;
  action: 'enabled' | 'disabled';
}

export const generateMfaNotificationTemplate = (props: MfaNotificationProps) => {
  const { displayName, action } = props;

  const subject = `Security Update: Two-Factor Authentication ${action === 'enabled' ? 'Activated' : 'Deactivated'}`;

  const html = buildMasterEmailHtml({
    preheader: `Two-Factor Authentication was ${action} on your ${BRAND_NAME} account.`,
    badgeText: 'Security Settings',
    badgeColor: action === 'enabled' ? '#10B981' : '#EF4444',
    badgeBg: action === 'enabled' ? '#D1FAE5' : '#FEE2E2',
    headline: `Two-Factor Authentication ${action === 'enabled' ? 'Enabled' : 'Disabled'}`,
    recipientName: displayName || 'Traveler',
    messageLines: [
      `Two-Factor Authentication (2FA) has been successfully <strong>${action}</strong> on your ${BRAND_NAME} account.`,
      action === 'enabled'
        ? `Your account now has an extra layer of protection when logging in from new devices.`
        : `Your account is no longer protected by Two-Factor Authentication. We strongly recommend keeping 2FA enabled.`,
    ],
    securityTip:
      `If you did not make this security update, please secure your account and contact us immediately at ${SUPPORT_EMAIL}.`,
  });

  const text = `
Hello ${displayName || 'Traveler'},

Two-Factor Authentication has been ${action} on your ${BRAND_NAME} account.

If you did not authorize this change, please contact our team immediately at ${SUPPORT_EMAIL}.

Support: ${SUPPORT_EMAIL}
© ${new Date().getFullYear()} ${BRAND_NAME} Inc.
`;

  return { subject, html, text };
};
