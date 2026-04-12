import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow } from '@tauri-apps/api/window'
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
import type { DailyNotePayload, SaveState, Screen } from './lib/types'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Something went sideways while syncing your note.'
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

  const saveTimerRef = useRef<number | null>(null)
  const activeFilePathRef = useRef<string | null>(null)

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
      if (!primaryFolder || isChoosingFolder || isLoading || isDirty) {
        return
      }

      const targetDateKey = getTodayDateKey()

      if (!note || note.dateKey !== targetDateKey || screen === 'settings') {
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
          currentFolder={primaryFolder}
          errorMessage={errorMessage}
          fileNamePreview={getTodayFileName()}
          isChoosingFolder={isChoosingFolder}
          onChooseFolder={handleChooseFolder}
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
