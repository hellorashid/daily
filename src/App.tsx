import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { open } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Update } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'

import './App.css'
import { AppShell } from './components/AppShell'
import { NoteView } from './components/NoteView'
import { SettingsView } from './components/SettingsView'
import {
  formatHeaderDate,
  formatHeaderDateFromKey,
  getTodayDateKey,
  getTodayFileName,
  shiftDateKey,
} from './lib/dates'
import {
  openCurrentNoteInDefaultApp,
  openCurrentNoteInFinder,
  openOrCreateNoteForDate,
  openOrCreateTodayNote,
  saveDailyNote,
  syncNotebookFolder,
} from './lib/note-client'
import {
  addNotebook,
  loadNotebookSettings,
  removeNotebook as removeNotebookFromStore,
  setActiveNotebookId as persistActiveNotebookId,
} from './lib/store'
import type {
  DailyNotePayload,
  Notebook,
  SaveState,
  Screen,
  UpdateStatus,
} from './lib/types'
import { checkForAppUpdate, installAppUpdate } from './lib/updater-client'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Something went sideways while syncing your note.'
}

function getUpdateErrorMessage(error: unknown) {
  const message = getErrorMessage(error)

  if (
    message.includes('latest.json')
    || message.includes('404')
    || message.includes('could not fetch a valid release')
  ) {
    return 'No published release is available yet.'
  }

  return message
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.append(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  textarea.remove()

  if (!copied) {
    throw new Error('Daily couldn’t copy that note to the clipboard.')
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
    return true
  }

  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
}

const UPDATE_CHECK_COOLDOWN_MS = 60 * 1000

function App() {
  const [screen, setScreen] = useState<Screen>('settings')
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null)
  const [note, setNote] = useState<DailyNotePayload | null>(null)
  const [draft, setDraft] = useState('')
  const [lastSavedContent, setLastSavedContent] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isChoosingFolder, setIsChoosingFolder] = useState(false)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    message: null,
    progress: null,
    state: 'idle',
    version: null,
  })

  const saveTimerRef = useRef<number | null>(null)
  const activeFilePathRef = useRef<string | null>(null)
  const pendingUpdateRef = useRef<Update | null>(null)
  const lastUpdateCheckAtRef = useRef<number>(0)
  const lastKnownTodayKeyRef = useRef(getTodayDateKey())
  const focusRefreshRequestRef = useRef(0)

  const isDirty = note !== null && draft !== lastSavedContent
  const activeNotebook = notebooks.find((notebook) => notebook.id === activeNotebookId) ?? null
  const activeFolder = activeNotebook?.folderPath ?? null
  const canReturnToNote = Boolean(activeFolder && note)
  const todayDateKey = getTodayDateKey()
  const title = note ? formatHeaderDateFromKey(note.dateKey) : formatHeaderDate()

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [])

  const hydrateNote = useCallback((payload: DailyNotePayload) => {
    setNote(payload)
    setDraft(payload.content)
    setLastSavedContent(payload.content)
    setSaveState('idle')
  }, [])

  const loadNoteForDate = useCallback(
    async (dateKey: string, options?: { showNote?: boolean }) => {
      const showNote = options?.showNote ?? true
      clearSaveTimer()
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const payload = await openOrCreateNoteForDate(dateKey)
        hydrateNote(payload)
        if (showNote) {
          setScreen('note')
        }
      } catch (error) {
        setSaveState('error')
        setErrorMessage(getErrorMessage(error))
        setScreen('settings')
      } finally {
        setIsLoading(false)
      }
    },
    [clearSaveTimer, hydrateNote],
  )

  const flushDraft = useCallback(
    async (content: string) => {
      if (!note) {
        return true
      }

      clearSaveTimer()
      const filePath = note.filePath
      const dateKey = note.dateKey

      setSaveState('saving')
      setErrorMessage(null)

      try {
        const result = await saveDailyNote(dateKey, content)

        if (activeFilePathRef.current !== filePath) {
          return true
        }

        setLastSavedContent(content)
        setNote((current) => {
          if (!current || current.filePath !== filePath) {
            return current
          }

          return {
            ...current,
            content,
          }
        })
        setSaveState(result.persisted ? 'saved' : 'idle')
        return true
      } catch (error) {
        setSaveState('error')
        setErrorMessage(getErrorMessage(error))
        return false
      }
    },
    [clearSaveTimer, note],
  )

  useEffect(() => {
    activeFilePathRef.current = note?.filePath ?? null
  }, [note])

  useEffect(() => {
    let cancelled = false

    void getVersion()
      .then((version) => {
        if (!cancelled) {
          setAppVersion(version)
        }
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      setIsLoading(true)

      try {
        const settings = await loadNotebookSettings()

        if (cancelled) {
          return
        }

        setNotebooks(settings.notebooks)
        setActiveNotebookId(settings.activeNotebookId)

        const folder = settings.notebooks.find((notebook) => notebook.id === settings.activeNotebookId)?.folderPath ?? null

        await syncNotebookFolder(folder)

        if (cancelled) {
          return
        }

        if (!folder) {
          setScreen('settings')
          return
        }

        const payload = await openOrCreateTodayNote()

        if (cancelled) {
          return
        }

        hydrateNote(payload)
        setScreen('note')
      } catch (error) {
        if (cancelled) {
          return
        }

        setSaveState('error')
        setErrorMessage(getErrorMessage(error))
        setScreen('settings')
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      clearSaveTimer()
    }
  }, [clearSaveTimer, hydrateNote])

  useEffect(() => {
    if (!note || !isDirty) {
      return
    }

    clearSaveTimer()
    setSaveState('idle')

    const timer = window.setTimeout(() => {
      void flushDraft(draft)
    }, 700)

    saveTimerRef.current = timer

    return () => {
      if (saveTimerRef.current === timer) {
        window.clearTimeout(timer)
        saveTimerRef.current = null
      }
    }
  }, [clearSaveTimer, draft, flushDraft, isDirty, note])

  const checkForUpdatesOnOpen = useEffectEvent(() => {
    if (isChoosingFolder || updateStatus.state === 'checking' || updateStatus.state === 'downloading') {
      return
    }

    const now = Date.now()

    if (now - lastUpdateCheckAtRef.current < UPDATE_CHECK_COOLDOWN_MS) {
      return
    }

    lastUpdateCheckAtRef.current = now
    void checkForUpdates()
  })

  const refreshNoteFromDisk = useEffectEvent(async (dateKey: string) => {
    if (!activeFolder || isChoosingFolder || isLoading || screen !== 'note' || isDirty) {
      return
    }

    const requestId = focusRefreshRequestRef.current + 1
    focusRefreshRequestRef.current = requestId

    try {
      const payload = await openOrCreateNoteForDate(dateKey)

      if (focusRefreshRequestRef.current !== requestId) {
        return
      }

      if (!activeFolder || isChoosingFolder || isLoading || screen !== 'note' || isDirty) {
        return
      }

      if (note && note.dateKey === dateKey && payload.content === lastSavedContent) {
        return
      }

      hydrateNote(payload)
    } catch (error) {
      if (focusRefreshRequestRef.current === requestId) {
        setSaveState('error')
        setErrorMessage(getErrorMessage(error))
      }
    }
  })

  const handleWindowFocus = useEffectEvent(() => {
    checkForUpdatesOnOpen()

    if (!activeFolder || isChoosingFolder || isLoading || isDirty || screen !== 'note') {
      return
    }

    const nextTodayKey = getTodayDateKey()
    const previousTodayKey = lastKnownTodayKeyRef.current
    lastKnownTodayKeyRef.current = nextTodayKey

    const targetDateKey =
      note && previousTodayKey !== nextTodayKey && note.dateKey === previousTodayKey
        ? nextTodayKey
        : note?.dateKey ?? nextTodayKey

    void refreshNoteFromDisk(targetDateKey)
  })

  const handleWindowBlur = useEffectEvent(() => {
    if (isChoosingFolder || isLoading || saveState === 'saving') {
      return
    }

    if (isDirty) {
      void flushDraft(draft)
    }
  })

  const handleVisibilityChange = useEffectEvent(() => {
    if (document.visibilityState === 'hidden') {
      handleWindowBlur()
    }
  })

  useEffect(() => {
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing || isChoosingFolder) {
      return
    }

    if (event.defaultPrevented) {
      return
    }

    const targetIsEditable = isEditableTarget(event.target)
    const key = event.key.toLowerCase()

    if (event.metaKey && !event.shiftKey && !event.altKey && key === 'o') {
      if (!note) {
        return
      }

      event.preventDefault()
      void handleOpenCurrentFile()
      return
    }

    if (event.metaKey && event.shiftKey && !event.altKey && key === 'o') {
      if (!note) {
        return
      }

      event.preventDefault()
      void handleOpenFolder()
      return
    }

    if (
      screen !== 'note'
      || !activeFolder
      || isLoading
      || targetIsEditable
      || event.metaKey
      || event.ctrlKey
      || event.altKey
    ) {
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      void handleNavigateDate(-1)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      void handleNavigateDate(1)
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown, true)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true)
    }
  }, [])

  async function handleAddNotebook() {
    if (note && isDirty) {
      const didSave = await flushDraft(draft)

      if (!didSave) {
        return
      }
    }

    setIsChoosingFolder(true)
    setErrorMessage(null)

    try {
      await invoke('set_window_auto_hide_enabled', { enabled: false })

      const selection = await open({
        directory: true,
        multiple: false,
        title: 'Add a Daily notebook folder',
      })

      const folderPath = Array.isArray(selection) ? selection[0] : selection

      if (!folderPath) {
        return
      }

      await syncNotebookFolder(folderPath)

      const nextSettings = await addNotebook(folderPath)
      setNotebooks(nextSettings.notebooks)
      setActiveNotebookId(nextSettings.activeNotebookId)

      const targetDateKey = note?.dateKey ?? getTodayDateKey()
      setNote(null)
      setDraft('')
      setLastSavedContent('')
      setSaveState('idle')
      await loadNoteForDate(targetDateKey, { showNote: notebooks.length === 0 })
    } catch (error) {
      setSaveState('error')
      setErrorMessage(getErrorMessage(error))
    } finally {
      await invoke('set_window_auto_hide_enabled', { enabled: true })
      await getCurrentWindow().setFocus().catch(() => null)
      setIsChoosingFolder(false)
    }
  }

  function handleSettingsToggle() {
    if (screen === 'settings') {
      if (canReturnToNote) {
        setScreen('note')
      }
      return
    }

    if (isDirty) {
      void flushDraft(draft)
    }

    setScreen('settings')
  }

  async function handleSelectNotebook(notebookId: string) {
    if (notebookId === activeNotebookId) {
      return
    }

    const notebook = notebooks.find((entry) => entry.id === notebookId)
    if (!notebook) {
      return
    }

    if (note && isDirty) {
      const didSave = await flushDraft(draft)

      if (!didSave) {
        return
      }
    }

    setErrorMessage(null)

    try {
      await syncNotebookFolder(notebook.folderPath)
      const nextSettings = await persistActiveNotebookId(notebookId)

      setNotebooks(nextSettings.notebooks)
      setActiveNotebookId(nextSettings.activeNotebookId)

      const targetDateKey = note?.dateKey ?? getTodayDateKey()
      setNote(null)
      setDraft('')
      setLastSavedContent('')
      setSaveState('idle')
      await loadNoteForDate(targetDateKey, { showNote: false })
    } catch (error) {
      setSaveState('error')
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleRemoveNotebook(notebookId: string) {
    const notebook = notebooks.find((entry) => entry.id === notebookId)

    if (!notebook) {
      return
    }

    const confirmed = window.confirm(
      `Remove notebook "${notebook.name}"? This will not delete any files.`,
    )

    if (!confirmed) {
      return
    }

    const previousActiveId = activeNotebookId

    if (notebookId === previousActiveId && note && isDirty) {
      const didSave = await flushDraft(draft)

      if (!didSave) {
        return
      }
    }

    setErrorMessage(null)

    try {
      const nextSettings = await removeNotebookFromStore(notebookId)
      setNotebooks(nextSettings.notebooks)
      setActiveNotebookId(nextSettings.activeNotebookId)

      if (nextSettings.activeNotebookId === previousActiveId) {
        return
      }

      const nextFolder =
        nextSettings.notebooks.find((entry) => entry.id === nextSettings.activeNotebookId)
          ?.folderPath ?? null

      await syncNotebookFolder(nextFolder)

      if (!nextFolder) {
        setNote(null)
        setDraft('')
        setLastSavedContent('')
        setSaveState('idle')
        setScreen('settings')
        return
      }

      const targetDateKey = note?.dateKey ?? getTodayDateKey()
      setNote(null)
      setDraft('')
      setLastSavedContent('')
      setSaveState('idle')
      await loadNoteForDate(targetDateKey, { showNote: false })
    } catch (error) {
      setSaveState('error')
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleOpenFolder() {
    if (!note) {
      return
    }

    try {
      if (isDirty) {
        const didSave = await flushDraft(draft)

        if (!didSave) {
          return
        }
      }

      await openCurrentNoteInFinder(note.dateKey)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleOpenCurrentFile() {
    if (!note) {
      return
    }

    try {
      if (isDirty) {
        const didSave = await flushDraft(draft)

        if (!didSave) {
          return
        }
      }

      await openCurrentNoteInDefaultApp(note.dateKey)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleCopyContents() {
    try {
      await copyTextToClipboard(draft)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function checkForUpdates() {
    setUpdateStatus({
      message: 'Checking GitHub Releases…',
      progress: null,
      state: 'checking',
      version: null,
    })

    try {
      const update = await checkForAppUpdate()
      pendingUpdateRef.current = update

      if (!update) {
        setUpdateStatus({
          message: 'You’re already on the latest version.',
          progress: null,
          state: 'up-to-date',
          version: null,
        })
        return
      }

      setUpdateStatus({
        message: 'A new version is ready to install.',
        progress: null,
        state: 'available',
        version: update.version,
      })
    } catch (error) {
      pendingUpdateRef.current = null
      setUpdateStatus({
        message: getUpdateErrorMessage(error),
        progress: null,
        state: 'error',
        version: null,
      })
    }
  }

  async function installUpdate(update: Update) {
    let downloaded = 0
    let contentLength = 0

    setUpdateStatus((current) => ({
      ...current,
      message: 'Downloading and installing the update…',
      progress: 0,
      state: 'downloading',
    }))

    try {
      await installAppUpdate(update, (event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0
            setUpdateStatus((current) => ({
              ...current,
              message: 'Downloading update…',
              progress: contentLength > 0 ? 0 : null,
              state: 'downloading',
            }))
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            setUpdateStatus((current) => ({
              ...current,
              progress:
                contentLength > 0
                  ? Math.min(100, Math.round((downloaded / contentLength) * 100))
                  : null,
              state: 'downloading',
            }))
            break
          case 'Finished':
            setUpdateStatus((current) => ({
              ...current,
              message: 'Update installed. Restarting Daily…',
              progress: 100,
              state: 'downloading',
            }))
            break
        }
      })
    } catch (error) {
      setUpdateStatus({
        message: getUpdateErrorMessage(error),
        progress: null,
        state: 'error',
        version: update.version,
      })
    }
  }

  async function handleUpdateAction() {
    if (updateStatus.state === 'checking' || updateStatus.state === 'downloading') {
      return
    }

    if (pendingUpdateRef.current && updateStatus.state === 'available') {
      await installUpdate(pendingUpdateRef.current)
      return
    }

    await checkForUpdates()
  }

  async function handleNavigateDate(delta: number) {
    if (!activeFolder || !note || isLoading) {
      return
    }

    const nextDateKey = shiftDateKey(note.dateKey, delta)

    if (delta > 0 && nextDateKey > todayDateKey) {
      return
    }

    if (isDirty) {
      const didSave = await flushDraft(draft)

      if (!didSave) {
        return
      }
    }

    await loadNoteForDate(nextDateKey)
  }

  async function handleSelectDate(dateKey: string) {
    if (!activeFolder || isLoading || screen === 'settings') {
      return
    }

    if (dateKey > todayDateKey || note?.dateKey === dateKey) {
      return
    }

    if (isDirty) {
      const didSave = await flushDraft(draft)

      if (!didSave) {
        return
      }
    }

    await loadNoteForDate(dateKey)
  }

  const updateStatusLabel =
    updateStatus.state === 'available' && updateStatus.version
      ? `Install v${updateStatus.version}`
      : updateStatus.state === 'checking'
        ? 'Checking for updates…'
        : updateStatus.state === 'downloading'
          ? updateStatus.progress !== null
            ? `Installing… ${updateStatus.progress}%`
            : 'Installing update…'
          : 'Check for updates'

  const updateSummary = updateStatus.message

  return (
    <AppShell
      calendarSourceKey={activeNotebookId ?? 'default'}
      currentDateKey={note?.dateKey ?? todayDateKey}
      disableDatePicker={!activeFolder || isLoading || screen === 'settings'}
      disableNoteActions={!note || isLoading}
      disableNavigation={!note || isLoading || screen === 'settings'}
      disableNextNavigation={!note || note.dateKey >= todayDateKey}
      isSettingsOpen={screen === 'settings'}
      maxDateKey={todayDateKey}
      onCopyContents={() => {
        void handleCopyContents()
      }}
      onDateSelect={(dateKey) => {
        void handleSelectDate(dateKey)
      }}
      onNavigateNext={() => {
        void handleNavigateDate(1)
      }}
      onNavigatePrevious={() => {
        void handleNavigateDate(-1)
      }}
      onOpenCurrentFile={() => {
        void handleOpenCurrentFile()
      }}
      onOpenInFinder={() => {
        void handleOpenFolder()
      }}
      onSettingsToggle={handleSettingsToggle}
      title={title}
    >
      {screen === 'settings' ? (
        <SettingsView
          appVersion={appVersion}
          activeNotebookId={activeNotebookId}
          errorMessage={errorMessage}
          fileNamePreview={getTodayFileName()}
          isChoosingFolder={isChoosingFolder}
          isUpdateActionDisabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
          notebooks={notebooks}
          onAddNotebook={handleAddNotebook}
          onRemoveNotebook={(notebookId) => {
            void handleRemoveNotebook(notebookId)
          }}
          onSelectNotebook={(notebookId) => {
            void handleSelectNotebook(notebookId)
          }}
          onUpdateAction={() => {
            void handleUpdateAction()
          }}
          updateStatusLabel={updateStatusLabel}
          updateSummary={updateSummary}
        />
	      ) : (
	        <NoteView
	          draft={draft}
	          errorMessage={saveState === 'error' ? errorMessage : null}
          isLoading={isLoading}
          note={note}
          onBlur={() => {
            if (isDirty) {
              void flushDraft(draft)
            }
	          }}
	          onChange={(value) => {
	            setDraft(value)
	            setSaveState('idle')
	          }}
	        />
	      )}
	    </AppShell>
	  )
}

export default App
