import type { TelegramBot } from './telegram.js';
import type { WhatsAppClient } from './whatsapp.js';

export interface MessagingConfig {
  telegram?: {
    botToken: string;
    chatId: string;
  };
  whatsapp?: {
    accessToken: string;
    phoneNumberId: string;
    recipientPhone: string;
  };
}

export interface MessagePayload {
  text: string;
  actions?: { label: string; id: string }[];
}

/**
 * Unified messaging hub. Sends messages to all configured channels.
 * Receives user responses (approve/reject) via callbacks.
 */
export class MessagingHub {
  private telegram: TelegramBot | null = null;
  private whatsapp: WhatsAppClient | null = null;
  private onAction: ((patternName: string, action: 'approve' | 'reject' | 'snooze') => void) | null = null;

  constructor(private config: MessagingConfig) {}

  setActionHandler(handler: (patternName: string, action: 'approve' | 'reject' | 'snooze') => void): void {
    this.onAction = handler;
  }

  async start(): Promise<void> {
    if (this.config.telegram) {
      const { TelegramBot: TgBot } = await import('./telegram.js');
      this.telegram = new TgBot(
        this.config.telegram.botToken,
        this.config.telegram.chatId,
      );
      this.telegram.setActionHandler((pattern, action) => {
        this.onAction?.(pattern, action);
      });
      await this.telegram.start();
    }

    if (this.config.whatsapp) {
      const { WhatsAppClient: WA } = await import('./whatsapp.js');
      this.whatsapp = new WA(
        this.config.whatsapp.accessToken,
        this.config.whatsapp.phoneNumberId,
        this.config.whatsapp.recipientPhone,
      );
    }
  }

  async stop(): Promise<void> {
    if (this.telegram) {
      await this.telegram.stop();
    }
  }

  async sendPatternDetected(
    patternName: string,
    description: string,
    steps: string[],
  ): Promise<void> {
    const stepsText = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

    const message = [
      `*Climpse: Pattern Detected*`,
      ``,
      `I noticed you ${description.toLowerCase()}`,
      ``,
      stepsText,
      ``,
      `Want me to automate this?`,
    ].join('\n');

    const actions = [
      { label: 'Yes, automate it', id: `approve:${patternName}` },
      { label: 'Not now', id: `snooze:${patternName}` },
      { label: 'Never', id: `reject:${patternName}` },
    ];

    await this.broadcast(message, actions);
  }

  async sendDailyDigest(summary: string): Promise<void> {
    await this.broadcast(summary);
  }

  async sendSimple(message: string): Promise<void> {
    await this.broadcast(message);
  }

  private async broadcast(
    text: string,
    actions?: { label: string; id: string }[],
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.telegram) {
      promises.push(this.telegram.sendMessage(text, actions));
    }

    if (this.whatsapp) {
      promises.push(this.whatsapp.sendMessage(text));
    }

    await Promise.allSettled(promises);
  }

  get isConfigured(): boolean {
    return !!(this.config.telegram || this.config.whatsapp);
  }
}
