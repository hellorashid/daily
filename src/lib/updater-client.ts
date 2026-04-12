import { relaunch } from '@tauri-apps/plugin-process'
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater'

export async function checkForAppUpdate() {
  return check()
}

export async function installAppUpdate(
  update: Update,
  onEvent?: (event: DownloadEvent) => void,
) {
  await update.downloadAndInstall(onEvent)
  await relaunch()
}
