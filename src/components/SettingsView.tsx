import { OnboardingPanel } from './OnboardingPanel'
import type { Notebook } from '../lib/types'

type SettingsViewProps = {
  appVersion: string | null
  activeNotebookId: string | null
  errorMessage: string | null
  fileNamePreview: string
  isChoosingFolder: boolean
  isUpdateActionDisabled: boolean
  notebooks: Notebook[]
  onAddNotebook: () => void
  onRemoveNotebook: (notebookId: string) => void
  onSelectNotebook: (notebookId: string) => void
  onUpdateAction: () => void
  updateStatusLabel: string
  updateSummary: string | null
}

export function SettingsView({
  appVersion,
  activeNotebookId,
  errorMessage,
  fileNamePreview,
  isChoosingFolder,
  isUpdateActionDisabled,
  notebooks,
  onAddNotebook,
  onRemoveNotebook,
  onSelectNotebook,
  onUpdateAction,
  updateStatusLabel,
  updateSummary,
}: SettingsViewProps) {
  const isOnboarding = notebooks.length === 0

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
                <kbd>⌘O</kbd>
                <span>Open current file</span>
              </span>
              <span className="settings-shortcut">
                <kbd>⌘⇧O</kbd>
                <span>Open in Finder</span>
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
            <span className="settings-footer-version">Version {appVersion ? appVersion : 'Loading…'}</span>
            <button
              className="settings-footer-update-button"
              disabled={isUpdateActionDisabled}
              onClick={onUpdateAction}
              type="button"
            >
              {updateStatusLabel}
            </button>
          </div>
          {updateSummary ? <p className="settings-footer-summary">{updateSummary}</p> : null}
        </div>
      </div>
    </section>
  )
}
