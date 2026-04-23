import { invoke } from '@tauri-apps/api/core'

import type { WindowOpenShortcutSetting } from './types'

type WindowOpenShortcutStatus = {
  registrationError: string | null
}

export function setWindowOpenShortcut(shortcut: WindowOpenShortcutSetting) {
  return invoke('set_window_open_shortcut', { shortcut })
}

export function getWindowOpenShortcutStatus() {
  return invoke<WindowOpenShortcutStatus>('get_window_open_shortcut_status')
}
