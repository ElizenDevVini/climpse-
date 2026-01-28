import notifier from 'node-notifier';

export interface NotificationOptions {
  title: string;
  message: string;
  actions?: string[];
  patternName?: string;
}

export class SystemNotifier {
  async notify(options: NotificationOptions): Promise<string | null> {
    return new Promise((resolve) => {
      notifier.notify(
        {
          title: options.title,
          message: options.message,
          sound: true,
          wait: true,
          closeLabel: 'Dismiss',
          actions: options.actions,
        },
        (err, response, metadata) => {
          if (err) {
            console.error('Notification error:', err);
            resolve(null);
            return;
          }

          // node-notifier returns the action/button clicked
          const action = (metadata as Record<string, unknown>)?.activationValue as string | undefined;
          resolve(action ?? response ?? null);
        }
      );
    });
  }

  async notifySimple(title: string, message: string): Promise<void> {
    notifier.notify({
      title,
      message,
      sound: false,
    });
  }
}
