import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../../config';
import { logger } from '../../config/logger';

export interface EmailProvider {
  sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void>;
}

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });

    this.transporter.verify().catch((error: unknown) => {
      logger.error('Failed to verify SMTP transporter:', error);
    });
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    const fromName = config.EMAIL_FROM_NAME || 'TripSplit';
    const fromAddress = config.EMAIL_FROM || 'tripSplit@proton.me';
    const mailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      replyTo: config.EMAIL_REPLY_TO || fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${options.to} with subject "${options.subject}"`);
    } catch (error) {
      logger.error(`Failed to send email to ${options.to}:`, error);
      // This re-throws the error to be handled by the calling service.
      throw new Error('Email sending failed.');
    }
  }
}

// Export a singleton instance of the email provider
export const emailProvider = new SmtpEmailProvider();
