import { config } from '../../config';

interface VerificationEmailProps {
  displayName: string;
  actionUrl: string;
}

export const generateVerificationEmailTemplate = (props: VerificationEmailProps) => {
  const { displayName, actionUrl } = props;
  const year = new Date().getFullYear();

  const subject = 'Verify your Wareku email address';

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f9f9f9;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #fff;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 40px;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #333;
        font-size: 24px;
        margin: 0;
      }
      .content {
        font-size: 16px;
      }
      .button {
        display: inline-block;
        background-color: #007bff;
        color: #ffffff;
        text-decoration: none;
        padding: 12px 25px;
        border-radius: 5px;
        margin-top: 20px;
        margin-bottom: 20px;
      }
      .fallback {
        font-size: 12px;
        color: #666;
        margin-top: 20px;
      }
      .footer {
        margin-top: 30px;
        font-size: 12px;
        color: #aaa;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Wareku</h1>
      </div>
      <div class="content">
        <p>Hello ${displayName},</p>
        <p>Welcome to Wareku 👋</p>
        <p>Please verify your email address to finish setting up your account.</p>
        <a href="${actionUrl}" class="button">Verify Email</a>
        <p class="fallback">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${actionUrl}">${actionUrl}</a>
        </p>
        <p>If you didn't create a Wareku account, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <p>Wareku Support | <a href="mailto:support@wareku.net">support@wareku.net</a></p>
        <p>&copy; ${year} Wareku</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const text = `
  Hello ${displayName},

  Welcome to Wareku 👋

  Please verify your email address to finish setting up your account by copying and pasting this link into your browser:

  ${actionUrl}

  If you didn't create a Wareku account, you can safely ignore this email.

  Wareku Support (support@wareku.net)
  © ${year} Wareku
  `;

  return { subject, html, text };
};

interface PasswordResetEmailProps {
  displayName: string;
  actionUrl: string;
}

export const generatePasswordResetTemplate = (props: PasswordResetEmailProps) => {
  const { displayName, actionUrl } = props;
  const year = new Date().getFullYear();

  const subject = 'Reset your Wareku password';

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f9f9f9;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #fff;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 40px;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #333;
        font-size: 24px;
        margin: 0;
      }
      .content {
        font-size: 16px;
      }
      .button {
        display: inline-block;
        background-color: #007bff;
        color: #ffffff;
        text-decoration: none;
        padding: 12px 25px;
        border-radius: 5px;
        margin-top: 20px;
        margin-bottom: 20px;
      }
      .fallback {
        font-size: 12px;
        color: #666;
        margin-top: 20px;
      }
      .footer {
        margin-top: 30px;
        font-size: 12px;
        color: #aaa;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Wareku</h1>
      </div>
      <div class="content">
        <p>Hello ${displayName},</p>
        <p>We received a request to reset your Wareku password.</p>
        <p>Click the button below to reset it. This link is valid for 1 hour.</p>
        <a href="${actionUrl}" class="button">Reset Password</a>
        <p class="fallback">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${actionUrl}">${actionUrl}</a>
        </p>
        <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      </div>
      <div class="footer">
        <p>Wareku Support | <a href="mailto:support@wareku.net">support@wareku.net</a></p>
        <p>&copy; ${year} Wareku</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const text = `
  Hello ${displayName},

  We received a request to reset your Wareku password. Click the link below to reset it. This link is valid for 1 hour.

  ${actionUrl}

  If you did not request a password reset, please ignore this email or contact support if you have concerns.

  Wareku Support (support@wareku.net)
  © ${year} Wareku
  `;

  return { subject, html, text };
};
