import { load, type Store } from '@tauri-apps/plugin-store'

import {
  DEFAULT_WINDOW_OPEN_SHORTCUT,
  WINDOW_OPEN_SHORTCUT_DISABLED,
  normalizeWindowOpenShortcutSetting,
} from './shortcuts'
import type {
  AppearanceSetting,
  Notebook,
  WindowOpenShortcutSetting,
} from './types'

const SETTINGS_FILE = 'settings.json'

const NOTEBOOKS_KEY = 'notebooks'
const ACTIVE_NOTEBOOK_ID_KEY = 'activeNotebookId'
const APPEARANCE_KEY = 'appearance'
const WINDOW_OPEN_SHORTCUT_KEY = 'windowOpenShortcut'
const WINDOW_OPEN_SHORTCUT_ENABLED_KEY = 'windowOpenShortcutEnabled'

// Legacy key used before notebooks were supported.
const PRIMARY_FOLDER_KEY = 'primaryFolder'

const APPEARANCE_VALUES = new Set<AppearanceSetting>(['light', 'dark', 'system'])

let storePromise: Promise<Store> | null = null
let cachedAppearanceSetting: AppearanceSetting | null = null
let cachedWindowOpenShortcutSetting: WindowOpenShortcutSetting | null = null
let cachedWindowOpenShortcutEnabledSetting: boolean | null = null

async function getSettingsStore() {
  if (!storePromise) {
    storePromise = load(SETTINGS_FILE, {
      autoSave: 150,
      defaults: {},
    })
  }

  return storePromise
}

export type NotebookSettings = {
  activeNotebookId: string | null
  notebooks: Notebook[]
}

type WindowOpenShortcutPreferences = {
  enabled: boolean
  shortcut: WindowOpenShortcutSetting
}

export function getCachedAppearanceSetting() {
  return cachedAppearanceSetting
}

export function getCachedWindowOpenShortcutSetting() {
  return cachedWindowOpenShortcutSetting
}

export function getCachedWindowOpenShortcutEnabledSetting() {
  return cachedWindowOpenShortcutEnabledSetting
}

function normalizeAppearanceSetting(value: unknown): AppearanceSetting | null {
  if (typeof value !== 'string') {
    return null
  }

  return APPEARANCE_VALUES.has(value as AppearanceSetting)
    ? (value as AppearanceSetting)
    : null
}

function generateNotebookId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

function deriveNotebookName(folderPath: string) {
  const normalized = folderPath.replace(/\/+$/, '')
  const segments = normalized.split('/').filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : 'Notebook'
}

function normalizeFolderPath(folderPath: string) {
  return folderPath.trim().replace(/\/+$/, '')
}

function normalizeNotebook(value: unknown): Notebook | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<Notebook>
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
  const folderPath = typeof candidate.folderPath === 'string'
    ? normalizeFolderPath(candidate.folderPath)
    : ''

  if (!id || !folderPath) {
    return null
  }

  const name = typeof candidate.name === 'string' && candidate.name.trim()
    ? candidate.name.trim()
    : deriveNotebookName(folderPath)

  return { id, name, folderPath }
}

function normalizeNotebooks(value: unknown): Notebook[] {
  if (!Array.isArray(value)) {
    return []
  }

  const notebooks: Notebook[] = []
  const seenIds = new Set<string>()

  for (const entry of value) {
    const notebook = normalizeNotebook(entry)
    if (!notebook || seenIds.has(notebook.id)) {
      continue
    }

    notebooks.push(notebook)
    seenIds.add(notebook.id)
  }

  return notebooks
}

function createNotebook(folderPath: string): Notebook {
  const normalizedPath = normalizeFolderPath(folderPath)
  return {
    id: generateNotebookId(),
    name: deriveNotebookName(normalizedPath),
    folderPath: normalizedPath,
  }
}

export async function persistNotebookSettings(settings: NotebookSettings) {
  const store = await getSettingsStore()
  await store.set(NOTEBOOKS_KEY, settings.notebooks)
  await store.set(ACTIVE_NOTEBOOK_ID_KEY, settings.activeNotebookId)
  await store.save()
}

export async function persistAppearanceSetting(appearance: AppearanceSetting) {
  const store = await getSettingsStore()
  await store.set(APPEARANCE_KEY, appearance)
  await store.save()
  cachedAppearanceSetting = appearance
}

export async function persistWindowOpenShortcutSetting(shortcut: WindowOpenShortcutSetting) {
  const normalizedShortcut = normalizeWindowOpenShortcutSetting(shortcut)

  if (!normalizedShortcut || normalizedShortcut === WINDOW_OPEN_SHORTCUT_DISABLED) {
    throw new Error('Daily couldn’t save that shortcut.')
  }

  const store = await getSettingsStore()
  await store.set(WINDOW_OPEN_SHORTCUT_KEY, normalizedShortcut)
  await store.save()
  cachedWindowOpenShortcutSetting = normalizedShortcut
}

export async function persistWindowOpenShortcutEnabledSetting(enabled: boolean) {
  const store = await getSettingsStore()
  await store.set(WINDOW_OPEN_SHORTCUT_ENABLED_KEY, enabled)
  await store.save()
  cachedWindowOpenShortcutEnabledSetting = enabled
}

export async function loadAppearanceSetting(): Promise<AppearanceSetting> {
  if (cachedAppearanceSetting) {
    return cachedAppearanceSetting
  }

  const store = await getSettingsStore()
  const storedAppearance = normalizeAppearanceSetting(
    await store.get<unknown>(APPEARANCE_KEY),
  )

  if (storedAppearance) {
    cachedAppearanceSetting = storedAppearance
    return storedAppearance
  }

  const existingKeys = (await store.keys()).filter((key) => key !== APPEARANCE_KEY)
  const nextAppearance: AppearanceSetting = existingKeys.length === 0 ? 'system' : 'light'

  await store.set(APPEARANCE_KEY, nextAppearance)
  await store.save()
  cachedAppearanceSetting = nextAppearance

  return nextAppearance
}

async function loadWindowOpenShortcutPreferences(): Promise<WindowOpenShortcutPreferences> {
  if (
    cachedWindowOpenShortcutSetting
    && cachedWindowOpenShortcutEnabledSetting !== null
  ) {
    return {
      enabled: cachedWindowOpenShortcutEnabledSetting,
      shortcut: cachedWindowOpenShortcutSetting,
    }
  }

  const store = await getSettingsStore()
  const storedShortcut = normalizeWindowOpenShortcutSetting(
    await store.get<string | null>(WINDOW_OPEN_SHORTCUT_KEY),
  )
  const storedEnabled = await store.get<boolean | null>(WINDOW_OPEN_SHORTCUT_ENABLED_KEY)

  const nextShortcut =
    storedShortcut && storedShortcut !== WINDOW_OPEN_SHORTCUT_DISABLED
      ? storedShortcut
      : DEFAULT_WINDOW_OPEN_SHORTCUT
  const nextEnabled =
    typeof storedEnabled === 'boolean'
      ? storedEnabled
      : storedShortcut !== WINDOW_OPEN_SHORTCUT_DISABLED

  const shouldPersistShortcut = storedShortcut !== nextShortcut
  const shouldPersistEnabled = storedEnabled !== nextEnabled

  if (shouldPersistShortcut) {
    await store.set(WINDOW_OPEN_SHORTCUT_KEY, nextShortcut)
  }

  if (shouldPersistEnabled) {
    await store.set(WINDOW_OPEN_SHORTCUT_ENABLED_KEY, nextEnabled)
  }

  if (shouldPersistShortcut || shouldPersistEnabled) {
    await store.save()
  }

  cachedWindowOpenShortcutSetting = nextShortcut
  cachedWindowOpenShortcutEnabledSetting = nextEnabled

  return {
    enabled: nextEnabled,
    shortcut: nextShortcut,
  }
}

export async function loadWindowOpenShortcutSetting(): Promise<WindowOpenShortcutSetting> {
  const settings = await loadWindowOpenShortcutPreferences()
  return settings.shortcut
}

export async function loadWindowOpenShortcutEnabledSetting(): Promise<boolean> {
  const settings = await loadWindowOpenShortcutPreferences()
  return settings.enabled
}

export async function loadNotebookSettings(): Promise<NotebookSettings> {
  const store = await getSettingsStore()

  const storedNotebooks = await store.get<unknown>(NOTEBOOKS_KEY)
  let notebooks = normalizeNotebooks(storedNotebooks)
  let activeNotebookId = (await store.get<string | null>(ACTIVE_NOTEBOOK_ID_KEY)) ?? null

  const legacyFolder = (await store.get<string | null>(PRIMARY_FOLDER_KEY)) ?? null

  if (notebooks.length === 0 && legacyFolder) {
    const notebook = createNotebook(legacyFolder)
    notebooks = [notebook]
    activeNotebookId = notebook.id

    await store.set(NOTEBOOKS_KEY, notebooks)
    await store.set(ACTIVE_NOTEBOOK_ID_KEY, activeNotebookId)
    await store.delete(PRIMARY_FOLDER_KEY)
    await store.save()
    return { notebooks, activeNotebookId }
  }

  if (notebooks.length === 0) {
    if (legacyFolder) {
      await store.delete(PRIMARY_FOLDER_KEY)
      await store.save()
    }

    return { notebooks: [], activeNotebookId: null }
  }

  if (!activeNotebookId || !notebooks.some((notebook) => notebook.id === activeNotebookId)) {
    activeNotebookId = notebooks[0].id
    await store.set(ACTIVE_NOTEBOOK_ID_KEY, activeNotebookId)
    await store.save()
  }

  return { notebooks, activeNotebookId }
}

export async function addNotebook(folderPath: string): Promise<NotebookSettings> {
  const current = await loadNotebookSettings()
  const trimmedPath = normalizeFolderPath(folderPath)

  if (!trimmedPath) {
    return current
  }

  const existing = current.notebooks.find((notebook) => notebook.folderPath === trimmedPath)

  if (existing) {
    const next = {
      notebooks: current.notebooks,
      activeNotebookId: existing.id,
    }
    await persistNotebookSettings(next)
    return next
  }

  const notebook = createNotebook(trimmedPath)
  const next = {
    notebooks: [...current.notebooks, notebook],
    activeNotebookId: notebook.id,
  }

  await persistNotebookSettings(next)
  return next
}

export async function setActiveNotebookId(notebookId: string): Promise<NotebookSettings> {
  const current = await loadNotebookSettings()

  if (!current.notebooks.some((notebook) => notebook.id === notebookId)) {
    return current
  }

  if (current.activeNotebookId === notebookId) {
    return current
  }

  const next = { ...current, activeNotebookId: notebookId }
  await persistNotebookSettings(next)
  return next
}

export async function removeNotebook(notebookId: string): Promise<NotebookSettings> {
  const current = await loadNotebookSettings()

  const nextNotebooks = current.notebooks.filter((notebook) => notebook.id !== notebookId)

  if (nextNotebooks.length === current.notebooks.length) {
    return current
  }

  const nextActiveNotebookId =
    current.activeNotebookId === notebookId ? (nextNotebooks[0]?.id ?? null) : current.activeNotebookId

  const next = {
    notebooks: nextNotebooks,
    activeNotebookId: nextActiveNotebookId,
  }

  await persistNotebookSettings(next)
  return next
}
