import { useEffect, useState } from 'react'

import { OnboardingPanel } from './OnboardingPanel'
import {
  getShortcutDefinition,
  shortcutFromKeyboardEvent,
} from '../lib/shortcuts'
import type {
  AppearanceSetting,
  Notebook,
  WindowOpenShortcutSetting,
} from '../lib/types'

function AppearanceIcon({ value }: { value: AppearanceSetting }) {
  if (value === 'light') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" fill="none" r="3.4" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18.01 5.99l-1.56 1.56M7.55 16.45l-1.56 1.56M18.01 18.01l-1.56-1.56M7.55 7.55 5.99 5.99"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    )
  }

  if (value === 'dark') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M17.2 14.2A6.7 6.7 0 0 1 9.8 6.8a6.3 6.3 0 0 1 .34-2.06A8.5 8.5 0 1 0 19.26 13.86a6.3 6.3 0 0 1-2.06.34Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect
        fill="none"
        height="11"
        rx="2.2"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
        width="15"
        x="4.5"
        y="5.5"
      />
      <path
        d="M9.2 19h5.6M12 16.5V19"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

const APPEARANCE_OPTIONS: { label: string; value: AppearanceSetting }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
]

function ShortcutKeycaps({ shortcut }: { shortcut: WindowOpenShortcutSetting }) {
  const definition = getShortcutDefinition(shortcut)

  return (
    <span className="settings-shortcut-kbd-row" aria-label={definition.spokenLabel}>
      {definition.displayParts.map((part, index) => (
        <kbd key={`${definition.shortcut}-${part}-${index}`}>{part}</kbd>
      ))}
    </span>
  )
}

type SettingsViewProps = {
  appearance: AppearanceSetting
  appVersion: string | null
  activeNotebookId: string | null
  errorMessage: string | null
  fileNamePreview: string
  isChoosingFolder: boolean
  isWindowOpenShortcutEnabled: boolean
  isWindowOpenShortcutUpdating: boolean
  isUpdateChecking: boolean
  isUpdateActionDisabled: boolean
  notebooks: Notebook[]
  onAddNotebook: () => void
  onAppearanceChange: (appearance: AppearanceSetting) => void
  onRemoveNotebook: (notebookId: string) => void
  onSelectNotebook: (notebookId: string) => void
  onUpdateAction: () => void
  onWindowOpenShortcutEnabledChange: (enabled: boolean) => Promise<boolean>
  onWindowOpenShortcutChange: (shortcut: WindowOpenShortcutSetting) => Promise<boolean>
  updateStatusLabel: string
  updateSummary: string | null
  versionStatusLabel: string | null
  windowOpenShortcutErrorMessage: string | null
  windowOpenShortcut: WindowOpenShortcutSetting
}

export function SettingsView({
  appearance,
  appVersion,
  activeNotebookId,
  errorMessage,
  fileNamePreview,
  isChoosingFolder,
  isWindowOpenShortcutEnabled,
  isWindowOpenShortcutUpdating,
  isUpdateChecking,
  isUpdateActionDisabled,
  notebooks,
  onAddNotebook,
  onAppearanceChange,
  onRemoveNotebook,
  onSelectNotebook,
  onUpdateAction,
  onWindowOpenShortcutEnabledChange,
  onWindowOpenShortcutChange,
  updateStatusLabel,
  updateSummary,
  versionStatusLabel,
  windowOpenShortcutErrorMessage,
  windowOpenShortcut,
}: SettingsViewProps) {
  const isOnboarding = notebooks.length === 0
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false)
  const shortcutDefinition = getShortcutDefinition(windowOpenShortcut)

  useEffect(() => {
    document.documentElement.dataset.windowOpenShortcutRecording = isRecordingShortcut ? 'true' : 'false'

    return () => {
      document.documentElement.dataset.windowOpenShortcutRecording = 'false'
    }
  }, [isRecordingShortcut])

  useEffect(() => {
    if (
      !isRecordingShortcut
      || isWindowOpenShortcutUpdating
      || !isWindowOpenShortcutEnabled
    ) {
      return
    }

    function handleShortcutCapture(event: KeyboardEvent) {
      event.preventDefault()
      event.stopPropagation()

      if (
        event.key === 'Escape'
        && !event.metaKey
        && !event.ctrlKey
        && !event.altKey
        && !event.shiftKey
      ) {
        setIsRecordingShortcut(false)
        return
      }

      const nextShortcut = shortcutFromKeyboardEvent(event)

      if (!nextShortcut) {
        return
      }

      void onWindowOpenShortcutChange(nextShortcut.shortcut).then((didUpdate) => {
        if (didUpdate) {
          setIsRecordingShortcut(false)
        }
      })
    }

    window.addEventListener('keydown', handleShortcutCapture, true)

    return () => {
      window.removeEventListener('keydown', handleShortcutCapture, true)
    }
  }, [
    isRecordingShortcut,
    isWindowOpenShortcutEnabled,
    isWindowOpenShortcutUpdating,
    onWindowOpenShortcutChange,
  ])

  return (
    <section className="settings-view">
      <div className="settings-panel">
        {isOnboarding ? (
          <OnboardingPanel
            fileNamePreview={fileNamePreview}
            isChoosingFolder={isChoosingFolder}
            onAddNotebook={onAddNotebook}
          />
        ) : (
          <div className="notebook-section" aria-label="Notebooks">
            <div className="notebook-section-header">
              <span className="settings-label">Notebooks</span>
              <button
                className="notebook-add-link"
                disabled={isChoosingFolder}
                onClick={onAddNotebook}
                type="button"
              >
                {isChoosingFolder ? 'Adding…' : 'Add'}
              </button>
            </div>

            <div className="notebook-list">
              {notebooks.map((notebook) => {
                const isActive = notebook.id === activeNotebookId

                return (
                  <div
                    className={`notebook-item${isActive ? ' active' : ''}`}
                    key={notebook.id}
                  >
                    <button
                      aria-current={isActive ? 'true' : undefined}
                      className="notebook-item-select"
                      disabled={isChoosingFolder}
                      onClick={() => {
                        onSelectNotebook(notebook.id)
                      }}
                      type="button"
                    >
                      <span className="notebook-item-row">
                        <span className="notebook-item-name">{notebook.name}</span>
                        {isActive ? <span className="notebook-item-badge">Active</span> : null}
                      </span>
                      <span className="settings-path">{notebook.folderPath}</span>
                    </button>
                    <button
                      aria-label={`Remove notebook ${notebook.name}`}
                      className="notebook-item-remove"
                      disabled={isChoosingFolder}
                      onClick={() => {
                        onRemoveNotebook(notebook.id)
                      }}
                      type="button"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path
                          d="M8 8l8 8M16 8l-8 8"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.7"
                        />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <details className="settings-subsection">
          <summary className="settings-subsection-trigger">
            <span className="settings-label">About</span>
            <span className="settings-subsection-chevron" aria-hidden="true">
              ›
            </span>
          </summary>
          <div className="settings-instructions">
            <p className="settings-instructions-copy">Daily is a tiny menu bar notebook for one simple habit: keep a plain markdown note for each day.</p>
            <p className="settings-instructions-copy">Add one or more notebook folders, then open the app from your menu bar whenever you want to capture thoughts, plans, or a quick daily log.</p>
            <p className="settings-instructions-copy">Everything saves automatically to normal `.md` files, so your notes stay easy to browse in Finder and easy to edit anywhere else.</p>
            <p className="settings-instructions-copy">Use the arrows or calendar to revisit older days without leaving the same compact window.</p>
            <div className="settings-shortcuts" aria-label="Keyboard shortcuts">
              <span className="settings-shortcut">
                {isWindowOpenShortcutEnabled ? (
                  <ShortcutKeycaps shortcut={windowOpenShortcut} />
                ) : (
                  <span className="settings-shortcut-disabled-label">Disabled</span>
                )}
                <span>Open Daily</span>
              </span>
              <span className="settings-shortcut">
                <kbd>⌘O</kbd>
                <span>Open current file</span>
              </span>
              <span className="settings-shortcut">
                <kbd>⌘⇧O</kbd>
                <span>Open in Finder</span>
              </span>
              <span className="settings-shortcut">
                <kbd>Esc</kbd>
                <span>Close Daily</span>
              </span>
              <span className="settings-shortcut">
                <kbd>←</kbd>
                <span>Previous day</span>
              </span>
              <span className="settings-shortcut">
                <kbd>→</kbd>
                <span>Next day</span>
              </span>
            </div>
          </div>
        </details>
        {errorMessage ? <p className="inline-message error">{errorMessage}</p> : null}
        <div className="settings-footer">
          <div className="settings-footer-row">
            <span className="settings-footer-version">
              Version {appVersion ? appVersion : 'Loading…'}
              {versionStatusLabel ? (
                <span className="settings-footer-version-status">({versionStatusLabel})</span>
              ) : null}
            </span>
            <button
              aria-busy={isUpdateChecking}
              className={`settings-footer-update-button${isUpdateChecking ? ' is-checking' : ''}`}
              disabled={isUpdateActionDisabled}
              onClick={onUpdateAction}
              type="button"
            >
              {isUpdateChecking ? (
                <>
                  <span aria-hidden="true" className="settings-footer-update-spinner" />
                  <span className="settings-visually-hidden">Checking for updates</span>
                </>
              ) : (
                updateStatusLabel
              )}
            </button>
          </div>
          <div className="settings-footer-appearance-row" aria-label="Appearance settings">
            <span className="settings-footer-label">Appearance</span>
            <div
              aria-label="Appearance"
              className="appearance-toggle compact"
              role="radiogroup"
            >
              {APPEARANCE_OPTIONS.map((option) => {
                const isActive = option.value === appearance

                return (
                  <label
                    className={`appearance-toggle-option${isActive ? ' active' : ''}`}
                    key={option.value}
                    title={option.label}
                  >
                    <input
                      aria-label={option.label}
                      checked={isActive}
                      className="appearance-toggle-input"
                      name="appearance"
                      onChange={() => {
                        onAppearanceChange(option.value)
                      }}
                      type="radio"
                      value={option.value}
                    />
                    <span className="appearance-toggle-label">
                      <span className="appearance-toggle-icon">
                        <AppearanceIcon value={option.value} />
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
          <div className="settings-footer-shortcut-row" aria-label="Global shortcut settings">
            <span className="settings-footer-label">Shortcut</span>
            <div className="settings-shortcut-controls">
              {isWindowOpenShortcutEnabled ? (
                <>
                  <button
                    aria-label={
                      isRecordingShortcut
                        ? 'Press a new global shortcut. Press Escape to cancel.'
                        : `Global shortcut ${shortcutDefinition.spokenLabel}. Press to record a new shortcut.`
                    }
                    aria-pressed={isRecordingShortcut}
                    className={`settings-shortcut-button${isRecordingShortcut ? ' is-recording' : ''}`}
                    disabled={isWindowOpenShortcutUpdating}
                    onClick={() => {
                      setIsRecordingShortcut((current) => !current)
                    }}
                    type="button"
                  >
                    {isRecordingShortcut ? (
                      <span className="settings-shortcut-recording-label">Press shortcut…</span>
                    ) : (
                      <ShortcutKeycaps shortcut={windowOpenShortcut} />
                    )}
                  </button>
                  <button
                    className="settings-shortcut-action-button"
                    disabled={isWindowOpenShortcutUpdating}
                    onClick={() => {
                      setIsRecordingShortcut(false)
                      void onWindowOpenShortcutEnabledChange(false)
                    }}
                    type="button"
                  >
                    Disable
                  </button>
                </>
              ) : (
                <button
                  className="settings-shortcut-action-button"
                  disabled={isWindowOpenShortcutUpdating}
                  onClick={() => {
                    setIsRecordingShortcut(false)
                    void onWindowOpenShortcutEnabledChange(true)
                  }}
                  type="button"
                >
                  Enable
                </button>
              )}
            </div>
          </div>
          {windowOpenShortcutErrorMessage ? (
            <p className="inline-message error">{windowOpenShortcutErrorMessage}</p>
          ) : null}
          {updateSummary ? <p className="settings-footer-summary">{updateSummary}</p> : null}
        </div>
      </div>
    </section>
  )
}
