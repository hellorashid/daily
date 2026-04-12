import { invoke } from '@tauri-apps/api/core'

import type {
  DailyNotePayload,
  ExistingNoteDatesPayload,
  SaveDailyNotePayload,
} from './types'

export function syncPrimaryFolder(folderPath: string | null) {
  return invoke('set_primary_folder', { folderPath })
}

export function openOrCreateTodayNote() {
  return invoke<DailyNotePayload>('open_or_create_today_note')
}

export function openOrCreateNoteForDate(dateKey: string) {
  return invoke<DailyNotePayload>('open_or_create_note_for_date', { dateKey })
}

export function saveDailyNote(dateKey: string, content: string) {
  return invoke<SaveDailyNotePayload>('save_daily_note', { dateKey, content })
}

export function openInFinder() {
  return invoke('open_in_finder')
}

export function findExistingNoteDates(startDateKey: string, endDateKey: string) {
  return invoke<ExistingNoteDatesPayload>('find_existing_note_dates', {
    startDateKey,
    endDateKey,
  })
}
