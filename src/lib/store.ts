import { load, type Store } from '@tauri-apps/plugin-store'

const SETTINGS_FILE = 'settings.json'
const PRIMARY_FOLDER_KEY = 'primaryFolder'

let storePromise: Promise<Store> | null = null

async function getSettingsStore() {
  if (!storePromise) {
    storePromise = load(SETTINGS_FILE, {
      autoSave: 150,
      defaults: {
        [PRIMARY_FOLDER_KEY]: null,
      },
    })
  }

  return storePromise
}

export async function loadPrimaryFolder() {
  const store = await getSettingsStore()
  return (await store.get<string | null>(PRIMARY_FOLDER_KEY)) ?? null
}

export async function persistPrimaryFolder(folderPath: string) {
  const store = await getSettingsStore()
  await store.set(PRIMARY_FOLDER_KEY, folderPath)
  await store.save()
}
