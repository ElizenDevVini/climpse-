import { loadConfig } from '../wizard/workspace.js';
import { MessagingHub } from '../messaging/index.js';

interface MessageOptions {
  test?: boolean;
}

export async function messageCommand(options: MessageOptions): Promise<void> {
  const config = loadConfig();
  if (!config?.workspace) {
    console.error('Climpse is not configured. Run `climpse setup` first.');
    process.exit(1);
  }

  if (!config.messaging || (!config.messaging.telegram && !config.messaging.whatsapp)) {
    console.error('No messaging channels configured.');
    console.error('Run `climpse setup` again to configure Telegram or WhatsApp.');
    process.exit(1);
  }

  const hub = new MessagingHub(config.messaging);

  if (options.test) {
    console.log('Sending test message...');

    const channels: string[] = [];
    if (config.messaging.telegram) channels.push('Telegram');
    if (config.messaging.whatsapp) channels.push('WhatsApp');

    await hub.start();

    await hub.sendSimple(
      `*Climpse Test*\n\nMessaging is working. Connected channels: ${channels.join(', ')}.`
    );

    console.log(`Test message sent to: ${channels.join(', ')}`);
    await hub.stop();
    return;
  }

  // Show messaging status
  console.log('Messaging Configuration:');
  console.log('');

  if (config.messaging.telegram) {
    console.log('  Telegram: Configured');
    console.log(`    Chat ID: ${config.messaging.telegram.chatId}`);
  } else {
    console.log('  Telegram: Not configured');
  }

  if (config.messaging.whatsapp) {
    console.log('  WhatsApp: Configured');
    console.log(`    Phone: ${config.messaging.whatsapp.recipientPhone}`);
  } else {
    console.log('  WhatsApp: Not configured');
  }

  console.log('');
  console.log('Run `climpse message --test` to send a test message.');
}
