import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ZeptoMailService {
  private readonly logger = new Logger(ZeptoMailService.name);

  async sendOtpEmail(toEmail: string, otp: string): Promise<void> {
    const token = process.env.ZEPTOMAIL_TOKEN;
    const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL;

    if (!token || !fromEmail) {
      throw new Error('ZeptoMail is not configured. Set ZEPTOMAIL_TOKEN and ZEPTOMAIL_FROM_EMAIL.');
    }

    const templateKey = process.env.ZEPTOMAIL_TEMPLATE_KEY;
    const from = { address: fromEmail, name: process.env.ZEPTOMAIL_FROM_NAME ?? 'TG' };
    const to = [{ email_address: { address: toEmail } }];

    // A configured Mail Agent template takes over the subject/body entirely — the
    // OTP is passed as a merge field rather than composed here.
    const url = templateKey ? this.templateApiUrl() : this.emailApiUrl();
    const body = templateKey
      ? {
          mail_template_key: templateKey,
          from,
          to,
          merge_info: {
            [process.env.ZEPTOMAIL_OTP_MERGE_FIELD ?? 'OTP']: otp,
            product_name: process.env.ZEPTOMAIL_PRODUCT_NAME ?? 'Tour Guide',
          },
        }
      : {
          from,
          to,
          subject: 'Your login OTP',
          htmlbody: `<p>Your one-time login code is <strong>${otp}</strong>.</p><p>This code expires in ${process.env.OTP_EXPIRY_MINUTES ?? '5'} minutes. If you didn't request this, you can ignore this email.</p>`,
        };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const resBody = await res.text();
      this.logger.error(`ZeptoMail send failed (${res.status}): ${resBody}`);
      throw new Error('Failed to send OTP email.');
    }
  }

  private emailApiUrl(): string {
    return process.env.ZEPTOMAIL_API_URL ?? 'https://api.zeptomail.com/v1.1/email';
  }

  private templateApiUrl(): string {
    return this.emailApiUrl().replace(/\/email\/?$/, '/email/template');
  }
}
