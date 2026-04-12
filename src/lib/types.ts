export type Screen = 'note' | 'settings'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export type DailyNotePayload = {
  content: string
  dateKey: string
  filePath: string
}

export type ExistingNoteDatesPayload = {
  dateKeys: string[]
}

export type SaveDailyNotePayload = {
  persisted: boolean
}
