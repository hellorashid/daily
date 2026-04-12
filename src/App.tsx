import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { open } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Update } from '@tauri-apps/plugin-updater'
import { startTransition, useCallback, useEffect, useRef, useState } from 'react'

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
  openInFinder,
  openOrCreateNoteForDate,
  openOrCreateTodayNote,
  saveDailyNote,
  syncPrimaryFolder,
} from './lib/note-client'
import { loadPrimaryFolder, persistPrimaryFolder } from './lib/store'
import type {
  DailyNotePayload,
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

function App() {
  const [screen, setScreen] = useState<Screen>('settings')
  const [primaryFolder, setPrimaryFolder] = useState<string | null>(null)
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

  const isDirty = note !== null && draft !== lastSavedContent
  const canReturnToNote = Boolean(primaryFolder && note)
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
    async (dateKey: string) => {
      clearSaveTimer()
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const payload = await openOrCreateNoteForDate(dateKey)
        hydrateNote(payload)
        setScreen('note')
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

  const loadTodayNote = useCallback(async () => loadNoteForDate(getTodayDateKey()), [loadNoteForDate])

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
        const folder = await loadPrimaryFolder()

        if (cancelled) {
          return
        }

        await syncPrimaryFolder(folder)

        if (cancelled) {
          return
        }

        setPrimaryFolder(folder)

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

  useEffect(() => {
    function handleWindowFocus() {
      if (!primaryFolder || isChoosingFolder || isLoading || isDirty || screen !== 'note') {
        return
      }

      const targetDateKey = getTodayDateKey()

      if (!note || note.dateKey !== targetDateKey) {
        void loadNoteForDate(targetDateKey)
      }
    }

    window.addEventListener('focus', handleWindowFocus)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [isChoosingFolder, isDirty, isLoading, loadNoteForDate, note, primaryFolder, screen])

  async function handleChooseFolder() {
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
        title: 'Choose your Daily notes folder',
      })

      const folderPath = Array.isArray(selection) ? selection[0] : selection

      if (!folderPath) {
        return
      }

      await persistPrimaryFolder(folderPath)
      await syncPrimaryFolder(folderPath)
      setPrimaryFolder(folderPath)
      await loadTodayNote()
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

  async function handleOpenFolder() {
    if (!primaryFolder) {
      return
    }

    try {
      await openInFinder()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  async function handleUpdateAction() {
    if (updateStatus.state === 'checking' || updateStatus.state === 'downloading') {
      return
    }

    if (pendingUpdateRef.current && updateStatus.state === 'available') {
      const update = pendingUpdateRef.current
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
                progress: contentLength > 0 ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : null,
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

      return
    }

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

  async function handleNavigateDate(delta: number) {
    if (!primaryFolder || !note || isLoading) {
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
    if (!primaryFolder || isLoading || screen === 'settings') {
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

  const updateSummary =
    updateStatus.message
    ?? 'GitHub Releases will power in-app updates after the first published release.'

  return (
    <AppShell
      currentDateKey={note?.dateKey ?? todayDateKey}
      disableFolderAction={!primaryFolder}
      disableDatePicker={!primaryFolder || isLoading || screen === 'settings'}
      disableNavigation={!note || isLoading || screen === 'settings'}
      disableNextNavigation={!note || note.dateKey >= todayDateKey}
      isSettingsOpen={screen === 'settings'}
      maxDateKey={todayDateKey}
      onDateSelect={(dateKey) => {
        void handleSelectDate(dateKey)
      }}
      onNavigateNext={() => {
        void handleNavigateDate(1)
      }}
      onNavigatePrevious={() => {
        void handleNavigateDate(-1)
      }}
      onOpenFolder={() => {
        void handleOpenFolder()
      }}
      onSettingsToggle={handleSettingsToggle}
      title={title}
    >
      {screen === 'settings' ? (
        <SettingsView
          appVersion={appVersion}
          currentFolder={primaryFolder}
          errorMessage={errorMessage}
          fileNamePreview={getTodayFileName()}
          isChoosingFolder={isChoosingFolder}
          isUpdateActionDisabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
          onChooseFolder={handleChooseFolder}
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
            startTransition(() => {
              setDraft(value)
              setSaveState('idle')
            })
          }}
        />
      )}
    </AppShell>
  )
}

export default App
