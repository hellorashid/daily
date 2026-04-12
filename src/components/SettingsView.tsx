type SettingsViewProps = {
  appVersion: string | null
  currentFolder: string | null
  errorMessage: string | null
  fileNamePreview: string
  isChoosingFolder: boolean
  isUpdateActionDisabled: boolean
  onChooseFolder: () => void
  onUpdateAction: () => void
  updateStatusLabel: string
  updateSummary: string
}

export function SettingsView({
  appVersion,
  currentFolder,
  errorMessage,
  fileNamePreview,
  isChoosingFolder,
  isUpdateActionDisabled,
  onChooseFolder,
  onUpdateAction,
  updateStatusLabel,
  updateSummary,
}: SettingsViewProps) {
  return (
    <section className="settings-view">
      <div className="settings-panel">
        <button
          className="folder-select-button"
          disabled={isChoosingFolder}
          onClick={onChooseFolder}
          type="button"
        >
          <span className="settings-label">Primary Folder</span>
          <span className={`settings-path${currentFolder ? '' : ' muted'}`}>
            {isChoosingFolder
              ? 'Choosing folder…'
              : currentFolder
                ? currentFolder
                : 'Choose primary folder'}
          </span>
        </button>
        <p className="settings-hint">Next note: {fileNamePreview}</p>
        <button
          className="folder-select-button"
          disabled={isUpdateActionDisabled}
          onClick={onUpdateAction}
          type="button"
        >
          <span className="settings-label">App Updates</span>
          <span className="settings-path">{updateStatusLabel}</span>
        </button>
        <p className="settings-hint">{updateSummary}</p>
        <p className="settings-meta">Current version: {appVersion ? `v${appVersion}` : 'Loading…'}</p>
        {errorMessage ? <p className="inline-message error">{errorMessage}</p> : null}
      </div>
    </section>
  )
}
