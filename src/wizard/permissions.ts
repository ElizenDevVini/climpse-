import * as p from '@clack/prompts';
import { platform } from 'os';

export async function checkPermissions(): Promise<boolean> {
  const os = platform();

  if (os === 'darwin') {
    return checkMacOSPermissions();
  }

  if (os === 'linux') {
    return checkLinuxPermissions();
  }

  p.log.warn(`Platform "${os}" is not fully supported yet.`);
  return false;
}

async function checkMacOSPermissions(): Promise<boolean> {
  p.log.info('macOS requires Screen Recording permission for window title access.');

  // Try to access active window to test permissions
  try {
    const { activeWindow } = await import('active-win');
    const win = await activeWindow();

    if (win) {
      p.log.success('Screen Recording permission granted.');
      return true;
    }

    // Window is undefined — might be permission denied or no focused window
    p.log.warn(
      'Could not detect active window. You may need to grant Screen Recording permission.'
    );
    p.log.info(
      'Go to System Settings → Privacy & Security → Screen Recording → Enable Climpse/Terminal'
    );

    const retry = await p.confirm({
      message: 'Have you granted the permission? Try again?',
    });

    if (p.isCancel(retry) || !retry) {
      return false;
    }

    const retryWin = await activeWindow();
    return retryWin !== undefined;
  } catch (err) {
    p.log.warn(`Permission check failed: ${(err as Error).message}`);
    p.log.info(
      'Go to System Settings → Privacy & Security → Screen Recording → Enable Terminal'
    );
    return false;
  }
}

async function checkLinuxPermissions(): Promise<boolean> {
  // Linux generally doesn't need special permissions for window titles
  // X11 allows reading window properties freely
  // Wayland is more restrictive but we handle that at runtime
  try {
    const { activeWindow } = await import('active-win');
    const win = await activeWindow();
    if (win) {
      p.log.success('Window tracking is working.');
      return true;
    }
    p.log.warn('Could not detect active window. Make sure you are using X11 or a compatible Wayland compositor.');
    return false;
  } catch (err) {
    p.log.warn(`Window tracking test failed: ${(err as Error).message}`);
    return false;
  }
}
