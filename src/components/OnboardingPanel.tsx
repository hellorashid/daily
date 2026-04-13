type OnboardingPanelProps = {
  fileNamePreview: string
  isChoosingFolder: boolean
  onAddNotebook: () => void
}

export function OnboardingPanel({
  fileNamePreview,
  isChoosingFolder,
  onAddNotebook,
}: OnboardingPanelProps) {
  return (
    <section className="onboarding-panel">
      <p className="onboarding-eyebrow">Welcome to Daily</p>
      <h2 className="onboarding-title">One plain markdown note for each day.</h2>
      <p className="onboarding-copy">
        Pick a notebook folder once and Daily will open today’s note from your menu bar whenever you need a
        quick place to think, plan, or log the day.
      </p>

      <div className="onboarding-steps" aria-label="How Daily works">
        <div className="onboarding-step">
          <span className="onboarding-step-number">1</span>
          <div className="onboarding-step-body">
            <p className="onboarding-step-title">Choose a notebook folder</p>
            <p className="onboarding-step-copy">Use any folder you already trust, like iCloud Drive, Dropbox, or a local notes directory.</p>
          </div>
        </div>
        <div className="onboarding-step">
          <span className="onboarding-step-number">2</span>
          <div className="onboarding-step-body">
            <p className="onboarding-step-title">Daily opens today’s file</p>
            <p className="onboarding-step-copy">
              Notes are stored as simple files like <code>{fileNamePreview}</code>.
            </p>
          </div>
        </div>
        <div className="onboarding-step">
          <span className="onboarding-step-number">3</span>
          <div className="onboarding-step-body">
            <p className="onboarding-step-title">Write and close</p>
            <p className="onboarding-step-copy">Your note saves automatically while you type, and stays easy to open anywhere else.</p>
          </div>
        </div>
      </div>

      <button
        autoFocus
        className="onboarding-primary-button"
        disabled={isChoosingFolder}
        onClick={onAddNotebook}
        type="button"
      >
        {isChoosingFolder ? 'Adding notebook…' : 'Add first notebook'}
      </button>

      <p className="onboarding-footnote">Everything stays local as normal markdown files in the folder you choose.</p>
    </section>
  )
}
