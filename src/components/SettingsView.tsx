type SettingsViewProps = {
  currentFolder: string | null
  errorMessage: string | null
  fileNamePreview: string
  isChoosingFolder: boolean
  onChooseFolder: () => void
}

export function SettingsView({
  currentFolder,
  errorMessage,
  fileNamePreview,
  isChoosingFolder,
  onChooseFolder,
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
        {errorMessage ? <p className="inline-message error">{errorMessage}</p> : null}
      </div>
    </section>
  )
}
