import TelegramBotApi from 'node-telegram-bot-api';

type ActionHandler = (patternName: string, action: 'approve' | 'reject' | 'snooze') => void;

/**
 * Telegram bot integration for Climpse.
 *
 * Sends pattern notifications with inline keyboard buttons.
 * Receives approve/reject/snooze callbacks from the user.
 */
export class TelegramBot {
  private bot: TelegramBotApi;
  private chatId: string;
  private actionHandler: ActionHandler | null = null;

  constructor(token: string, chatId: string) {
    this.bot = new TelegramBotApi(token, { polling: true });
    this.chatId = chatId;
  }

  setActionHandler(handler: ActionHandler): void {
    this.actionHandler = handler;
  }

  async start(): Promise<void> {
    // Handle inline keyboard callbacks
    this.bot.on('callback_query', async (query) => {
      if (!query.data) return;

      const [action, patternName] = query.data.split(':');
      if (!action || !patternName) return;

      const validActions = ['approve', 'reject', 'snooze'] as const;
      if (!validActions.includes(action as typeof validActions[number])) return;

      // Acknowledge the callback
      await this.bot.answerCallbackQuery(query.id, {
        text: action === 'approve'
          ? 'Pattern approved! Will automate it.'
          : action === 'reject'
            ? 'Pattern rejected. Won\'t ask again.'
            : 'Got it. Will remind you later.',
      });

      // Update the message to show the choice
      if (query.message) {
        const statusEmoji = action === 'approve' ? '\u2705' : action === 'reject' ? '\u274c' : '\u23f0';
        const statusText = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Snoozed';
        await this.bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
          },
        );
        await this.bot.sendMessage(
          this.chatId,
          `${statusEmoji} Pattern "${patternName}" — ${statusText}`,
        );
      }

      this.actionHandler?.(patternName, action as 'approve' | 'reject' | 'snooze');
    });

    // Handle /status command
    this.bot.onText(/\/status/, async (msg) => {
      if (msg.chat.id.toString() !== this.chatId) return;
      await this.bot.sendMessage(this.chatId, 'Climpse is running and observing.');
    });

    // Handle /patterns command
    this.bot.onText(/\/patterns/, async (msg) => {
      if (msg.chat.id.toString() !== this.chatId) return;
      await this.bot.sendMessage(
        this.chatId,
        'Use `climpse patterns` on your machine to see all learned patterns.',
        { parse_mode: 'Markdown' },
      );
    });

    // Welcome message on /start
    this.bot.onText(/\/start/, async (msg) => {
      if (msg.chat.id.toString() !== this.chatId) return;
      await this.bot.sendMessage(
        this.chatId,
        [
          '*Climpse Bot Connected*',
          '',
          'I\'ll send you notifications when I detect workflow patterns.',
          '',
          'Commands:',
          '/status — Check if Climpse is running',
          '/patterns — Info about learned patterns',
        ].join('\n'),
        { parse_mode: 'Markdown' },
      );
    });
  }

  async stop(): Promise<void> {
    await this.bot.stopPolling();
  }

  async sendMessage(
    text: string,
    actions?: { label: string; id: string }[],
  ): Promise<void> {
    const options: TelegramBotApi.SendMessageOptions = {
      parse_mode: 'Markdown',
    };

    if (actions && actions.length > 0) {
      options.reply_markup = {
        inline_keyboard: [
          actions.map(a => ({
            text: a.label,
            callback_data: a.id,
          })),
        ],
      };
    }

    await this.bot.sendMessage(this.chatId, text, options);
  }
}
