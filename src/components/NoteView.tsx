import type { DailyNotePayload } from '../lib/types'
import { InkMarkdownEditor } from './InkMarkdownEditor'

type NoteViewProps = {
  draft: string
  errorMessage: string | null
  isLoading: boolean
  note: DailyNotePayload | null
  onBlur: () => void
  onChange: (value: string) => void
}

export function NoteView({ draft, errorMessage, isLoading, note, onBlur, onChange }: NoteViewProps) {
  return (
    <section className="note-view">
      {errorMessage ? <p className="inline-message error">{errorMessage}</p> : null}
      <div className={`ink-editor-shell${isLoading || note === null ? ' is-loading' : ''}`}>
        <InkMarkdownEditor
          className="ink-editor-host"
          documentKey={note?.filePath ?? 'daily-note'}
          isLoading={isLoading || note === null}
          onBlur={onBlur}
          onChange={onChange}
          value={draft}
        />
      </div>
    </section>
  )
}
