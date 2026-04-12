import { useEffect, useMemo, useState } from 'react'

import {
  buildCalendarGrid,
  formatCalendarDayNumber,
  formatCalendarMonthLabel,
  getTodayDateKey,
  parseDateKey,
  shiftMonth,
  toDateKey,
} from '../lib/dates'
import { findExistingNoteDates } from '../lib/note-client'

type CalendarPopoverProps = {
  maxDateKey: string
  onClose: () => void
  onSelect: (dateKey: string) => void
  selectedDateKey: string
}

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function CalendarPopover({
  maxDateKey,
  onClose,
  onSelect,
  selectedDateKey,
}: CalendarPopoverProps) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    parseDateKey(selectedDateKey),
  )
  const [existingDateKeys, setExistingDateKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    setVisibleMonth(parseDateKey(selectedDateKey))
  }, [selectedDateKey])

  const monthStart = useMemo(
    () => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1),
    [visibleMonth],
  )

  const maxMonthStart = useMemo(() => {
    const maxDate = parseDateKey(maxDateKey)
    return new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
  }, [maxDateKey])

  const days = useMemo(() => buildCalendarGrid(monthStart), [monthStart])
  const todayDateKey = getTodayDateKey()
  const canGoNextMonth = toDateKey(monthStart) < toDateKey(maxMonthStart)

  useEffect(() => {
    let cancelled = false

    async function loadExistingDates() {
      const startDateKey = toDateKey(days[0])
      const endDateKey = toDateKey(days[days.length - 1])

      try {
        const result = await findExistingNoteDates(startDateKey, endDateKey)

        if (!cancelled) {
          setExistingDateKeys(new Set(result.dateKeys))
        }
      } catch {
        if (!cancelled) {
          setExistingDateKeys(new Set())
        }
      }
    }

    void loadExistingDates()

    return () => {
      cancelled = true
    }
  }, [days])

  return (
    <div
      aria-label="Choose note date"
      className="calendar-popover"
      role="dialog"
    >
      <div className="calendar-popover-header">
        <button
          aria-label="Previous month"
          className="calendar-month-nav"
          onClick={() => {
            setVisibleMonth((current) => shiftMonth(current, -1))
          }}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="m14.5 6.5-5 5 5 5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          </svg>
        </button>

        <p className="calendar-month-label">{formatCalendarMonthLabel(monthStart)}</p>

        <button
          aria-label="Next month"
          className="calendar-month-nav"
          disabled={!canGoNextMonth}
          onClick={() => {
            setVisibleMonth((current) => shiftMonth(current, 1))
          }}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="m9.5 6.5 5 5-5 5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.6"
            />
          </svg>
        </button>
      </div>

      <div className="calendar-weekdays">
        {weekdayLabels.map((label) => (
          <span className="calendar-weekday" key={label}>
            {label}
          </span>
        ))}
      </div>

      <div className="calendar-grid">
        {days.map((date) => {
          const dateKey = toDateKey(date)
          const isOutsideMonth = date.getMonth() !== monthStart.getMonth()
          const isFuture = dateKey > maxDateKey
          const isSelected = dateKey === selectedDateKey
          const isToday = dateKey === todayDateKey
          const hasNote = existingDateKeys.has(dateKey)

          return (
            <button
              aria-pressed={isSelected}
              className={[
                'calendar-day',
                hasNote ? 'has-note' : '',
                isOutsideMonth ? 'is-outside-month' : '',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={isFuture}
              key={dateKey}
              onClick={() => {
                onSelect(dateKey)
                onClose()
              }}
              type="button"
            >
              <span className="calendar-day-number">{formatCalendarDayNumber(date)}</span>
              {hasNote ? <span aria-hidden="true" className="calendar-day-note-indicator" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
