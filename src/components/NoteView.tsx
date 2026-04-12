import { Suspense, lazy } from 'react'

import type { DailyNotePayload } from '../lib/types'

const InkMarkdownEditor = lazy(async () => {
  const module = await import('./InkMarkdownEditor')

  return {
    default: module.InkMarkdownEditor,
  }
})

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
        <Suspense fallback={<div className="ink-editor-host" />}>
          <InkMarkdownEditor
            className="ink-editor-host"
            documentKey={note?.filePath ?? 'daily-note'}
            isLoading={isLoading || note === null}
            onBlur={onBlur}
            onChange={onChange}
            value={draft}
          />
        </Suspense>
      </div>
    </section>
  )
}
