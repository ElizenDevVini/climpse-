/**
 * WhatsApp Business Cloud API integration for Climpse.
 *
 * Uses the official Meta WhatsApp Business API (HTTP-based).
 * No browser automation or Puppeteer needed.
 *
 * Setup:
 * 1. Create a Meta Business account at business.facebook.com
 * 2. Set up WhatsApp Business API at developers.facebook.com
 * 3. Get your Phone Number ID and permanent access token
 * 4. Add the recipient phone number to your test contacts
 */
export class WhatsAppClient {
  private accessToken: string;
  private phoneNumberId: string;
  private recipientPhone: string;
  private baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(
    accessToken: string,
    phoneNumberId: string,
    recipientPhone: string,
  ) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.recipientPhone = recipientPhone;
  }

  async sendMessage(text: string): Promise<void> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: this.recipientPhone,
      type: 'text',
      text: { body: text },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error (${response.status}): ${error}`);
    }
  }

  async sendInteractive(
    headerText: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
  ): Promise<void> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: this.recipientPhone,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: headerText,
        },
        body: {
          text: bodyText,
        },
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: 'reply',
            reply: {
              id: b.id,
              title: b.title.slice(0, 20), // WhatsApp limits button titles to 20 chars
            },
          })),
        },
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error (${response.status}): ${error}`);
    }
  }

  async sendPatternNotification(
    patternName: string,
    description: string,
    steps: string[],
  ): Promise<void> {
    const stepsText = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

    await this.sendInteractive(
      'Climpse: Pattern Detected',
      `${description}\n\n${stepsText}\n\nWant me to automate this?`,
      [
        { id: `approve:${patternName}`, title: 'Yes' },
        { id: `snooze:${patternName}`, title: 'Not now' },
        { id: `reject:${patternName}`, title: 'Never' },
      ],
    );
  }
}
