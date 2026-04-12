import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater'

export async function checkForAppUpdate() {
  const { check } = await import('@tauri-apps/plugin-updater')

  return check()
}

export async function installAppUpdate(
  update: Update,
  onEvent?: (event: DownloadEvent) => void,
) {
  const { relaunch } = await import('@tauri-apps/plugin-process')

  await update.downloadAndInstall(onEvent)
  await relaunch()
}
