import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  async sendOtp(toPhoneNumber: string, otp: string): Promise<void> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      throw new Error('WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.');
    }

    const apiVersion = process.env.WHATSAPP_API_VERSION ?? 'v20.0';
    const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? 'otp_login';
    const templateLang = process.env.WHATSAPP_OTP_TEMPLATE_LANG ?? 'en_US';
    const to = toPhoneNumber.replace(/[^\d]/g, '');

    const components: Record<string, any>[] = [
      { type: 'body', parameters: [{ type: 'text', text: otp }] },
    ];

    // Meta's "copy code" authentication templates carry the code again as an
    // auth-button URL parameter — only send it when that button component exists.
    if (process.env.WHATSAPP_OTP_BUTTON_ENABLED === 'true') {
      components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] });
    }

    const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`WhatsApp send failed (${res.status}): ${body}`);
      throw new Error('Failed to send OTP via WhatsApp.');
    }
  }
}
