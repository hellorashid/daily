export type Screen = 'note' | 'settings'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'up-to-date'
  | 'error'

export type UpdateStatus = {
  message: string | null
  progress: number | null
  state: UpdateState
  version: string | null
}

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

export type Notebook = {
  id: string
  name: string
  folderPath: string
}
