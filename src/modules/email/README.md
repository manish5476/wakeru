# Email Module

This module is responsible for handling all email-related functionalities in the Wareku application. It provides a centralized and abstracted way to send transactional emails, manage email templates, and interact with email providers.

## Architecture

The email module follows a modular and provider-based architecture to ensure flexibility and scalability.

- **`email.provider.ts`**: This file contains the `EmailProvider` interface and its implementations. The interface defines a standard `sendEmail` method that all providers must implement. The initial implementation uses `Nodemailer` for SMTP-based email delivery, but it can be easily swapped with other providers like SendGrid, Resend, etc., by creating a new class that implements the `EmailProvider` interface.

- **`email.service.ts`**: This service acts as a bridge between the application's business logic and the email provider. It encapsulates the logic for sending different types of emails, such as password resets and email verifications. It uses the `emailProvider` to send the emails, so the rest of the application doesn't need to know the specific implementation details of the email provider.

- **`email.templates.ts`**: This file is responsible for generating the HTML and plain-text content of the emails. It uses template literals to create dynamic and branded email templates. Each email type has its own template generation function, which makes it easy to manage and customize the email content.

- **`firebase.utils.ts`**: This utility file contains helper functions for interacting with the Firebase Admin SDK. It includes a function to generate secure, custom authentication action links for email verification and password resets. This ensures that the application uses Firebase's robust and secure authentication mechanisms.

## Email Templates

The module includes the following email templates:

- **Verification Email**: Sent to new users to verify their email address.
- **Password Reset Email**: Sent to users who have requested a password reset.
- **Email Changed Notification**: Sent to users to notify them that their email address has been changed.
- **MFA/Security Notification**: A template for various security-related notifications, such as when a new authentication method is added.

Each template is designed to be responsive, mobile-friendly, and consistent with the Wareku branding.

## Environment Variables

The email module relies on the following environment variables for its configuration:

- `EMAIL_FROM`: The "from" email address for outgoing emails.
- `EMAIL_FROM_NAME`: The name to be displayed as the sender.
- `EMAIL_REPLY_TO`: The reply-to address for the emails.
- `SMTP_HOST`: The hostname of the SMTP server.
- `SMTP_PORT`: The port of the SMTP server.
- `SMTP_USER`: The username for SMTP authentication.
- `SMTP_PASS`: The password for SMTP authentication.

Make sure to set these variables in your `.env` file.

## Usage

To send an email, you can import the `email.service.ts` and call the appropriate function. For example, to send a password reset email:

```typescript
import { sendPasswordResetEmail } from '../email/email.service';
import { getAuth } from 'firebase-admin/auth';

const user = await getAuth().getUserByEmail(email);
await sendPasswordResetEmail(user);
```

This will generate a secure password reset link, create a branded email, and send it to the user through the configured email provider.
