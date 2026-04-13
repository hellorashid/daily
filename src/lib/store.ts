import { load, type Store } from '@tauri-apps/plugin-store'

import type { Notebook } from './types'

const SETTINGS_FILE = 'settings.json'

const NOTEBOOKS_KEY = 'notebooks'
const ACTIVE_NOTEBOOK_ID_KEY = 'activeNotebookId'

// Legacy key used before notebooks were supported.
const PRIMARY_FOLDER_KEY = 'primaryFolder'

let storePromise: Promise<Store> | null = null

async function getSettingsStore() {
  if (!storePromise) {
    storePromise = load(SETTINGS_FILE, {
      autoSave: 150,
      defaults: {
        [NOTEBOOKS_KEY]: [],
        [ACTIVE_NOTEBOOK_ID_KEY]: null,
        [PRIMARY_FOLDER_KEY]: null,
      },
    })
  }

  return storePromise
}

export type NotebookSettings = {
  activeNotebookId: string | null
  notebooks: Notebook[]
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
