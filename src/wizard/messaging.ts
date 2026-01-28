import * as p from '@clack/prompts';
import type { MessagingConfig } from '../messaging/index.js';

export async function configureMessaging(): Promise<MessagingConfig> {
  const channels = await p.multiselect({
    message: 'Enable messaging channels (optional)',
    options: [
      { value: 'telegram', label: 'Telegram Bot', hint: 'get notified via Telegram' },
      { value: 'whatsapp', label: 'WhatsApp', hint: 'via WhatsApp Business API' },
    ],
    required: false,
  });

  if (p.isCancel(channels)) {
    return {};
  }

  const selected = channels as string[];
  const config: MessagingConfig = {};

  if (selected.includes('telegram')) {
    p.log.info('Set up a Telegram bot via @BotFather and get your bot token.');
    p.log.info('Then send /start to your bot and get your chat ID.');

    const botToken = await p.password({
      message: 'Telegram bot token',
    });

    if (p.isCancel(botToken)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    const chatId = await p.text({
      message: 'Your Telegram chat ID',
      validate(value) {
        if (!value) return 'Chat ID is required';
        return undefined;
      },
    });

    if (p.isCancel(chatId)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    config.telegram = {
      botToken: botToken as string,
      chatId: chatId as string,
    };

    p.log.success('Telegram configured.');
  }

  if (selected.includes('whatsapp')) {
    p.log.info('Set up WhatsApp Business API at developers.facebook.com');
    p.log.info('You need: access token, phone number ID, and recipient phone.');

    const accessToken = await p.password({
      message: 'WhatsApp Business API access token',
    });

    if (p.isCancel(accessToken)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    const phoneNumberId = await p.text({
      message: 'WhatsApp phone number ID',
      validate(value) {
        if (!value) return 'Phone number ID is required';
        return undefined;
      },
    });

    if (p.isCancel(phoneNumberId)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    const recipientPhone = await p.text({
      message: 'Recipient phone number (with country code, e.g. 14155551234)',
      validate(value) {
        if (!value) return 'Phone number is required';
        if (!/^\d+$/.test(value)) return 'Use digits only (no + or spaces)';
        return undefined;
      },
    });

    if (p.isCancel(recipientPhone)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    config.whatsapp = {
      accessToken: accessToken as string,
      phoneNumberId: phoneNumberId as string,
      recipientPhone: recipientPhone as string,
    };

    p.log.success('WhatsApp configured.');
  }

  return config;
}
