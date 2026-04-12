import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { CalendarPopover } from './CalendarPopover'

type AppShellProps = {
  children: ReactNode
  currentDateKey: string
  disableFolderAction: boolean
  disableDatePicker: boolean
  disableNavigation: boolean
  disableNextNavigation: boolean
  isSettingsOpen: boolean
  maxDateKey: string
  onDateSelect: (dateKey: string) => void
  onNavigateNext: () => void
  onNavigatePrevious: () => void
  onOpenFolder: () => void
  onSettingsToggle: () => void
  title: string
}

export function AppShell({
  children,
  currentDateKey,
  disableFolderAction,
  disableDatePicker,
  disableNavigation,
  disableNextNavigation,
  isSettingsOpen,
  maxDateKey,
  onDateSelect,
  onNavigateNext,
  onNavigatePrevious,
  onOpenFolder,
  onSettingsToggle,
  title,
}: AppShellProps) {
  const datePickerRef = useRef<HTMLDivElement | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  useEffect(() => {
    if (!isCalendarOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (!datePickerRef.current?.contains(target)) {
        setIsCalendarOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsCalendarOpen(false)
      }
    }

    function handleWindowBlur() {
      setIsCalendarOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [isCalendarOpen])

  useEffect(() => {
    if (disableDatePicker && isCalendarOpen) {
      const frame = window.requestAnimationFrame(() => {
        setIsCalendarOpen(false)
      })

      return () => {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [disableDatePicker, isCalendarOpen])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsCalendarOpen(false)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [currentDateKey])

  function handleToggleDatePicker() {
    if (disableDatePicker) {
      return
    }

    setIsCalendarOpen((current) => !current)
  }

  return (
    <main className="app-shell">
      <div className="panel-frame">
        <header className="panel-header">
          <div className="header-side">
            <button
              aria-label="Previous day"
              className="header-icon"
              disabled={disableNavigation}
              onClick={onNavigatePrevious}
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
            <div
              className="header-date-wrap"
              onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
                event.stopPropagation()
              }}
              ref={datePickerRef}
            >
              <button
                aria-expanded={isCalendarOpen}
                aria-label="Choose note date"
                className={`header-icon header-date-trigger${isCalendarOpen ? ' active' : ''}`}
                disabled={disableDatePicker}
                onClick={handleToggleDatePicker}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path
                    d="M7 4.5v2.2M17 4.5v2.2M5.5 8.2h13M6.3 6.5h11.4a.8.8 0 0 1 .8.8v10a1.2 1.2 0 0 1-1.2 1.2H6.7a1.2 1.2 0 0 1-1.2-1.2v-10a.8.8 0 0 1 .8-.8Z"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.45"
                  />
                  <path
                    d="m10 13 2 2 3.5-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.45"
                  />
                </svg>
              </button>

              {isCalendarOpen ? (
                <CalendarPopover
                  maxDateKey={maxDateKey}
                  onClose={() => {
                    setIsCalendarOpen(false)
                  }}
                  onSelect={onDateSelect}
                  selectedDateKey={currentDateKey}
                />
              ) : null}
            </div>
            <button
              aria-label="Next day"
              className="header-icon"
              disabled={disableNavigation || disableNextNavigation}
              onClick={onNavigateNext}
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
          <h1 className="header-title">{title}</h1>
          <div className="header-side header-side-right">
            <button
              aria-label="Open folder in Finder"
              className="header-icon"
              disabled={disableFolderAction}
              onClick={onOpenFolder}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path
                  d="M3.5 7.5h5l1.6 2H20a.5.5 0 0 1 .5.5v7.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
            <button
              aria-label={isSettingsOpen ? 'Return to note' : 'Open settings'}
              className={`header-icon${isSettingsOpen ? ' active' : ''}`}
              onClick={onSettingsToggle}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path
                  d="M12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Zm9 3.3-.08-.88-2.2-.62a7.35 7.35 0 0 0-.58-1.4l1.1-2-1.76-1.77-2 1.1a7.34 7.34 0 0 0-1.4-.58l-.62-2.2L12 3l-.88.08-.62 2.2c-.49.13-.96.32-1.4.58l-2-1.1-1.77 1.76 1.1 2c-.26.44-.45.91-.58 1.4l-2.2.62L3 12l.08.88 2.2.62c.13.49.32.96.58 1.4l-1.1 2 1.76 1.77 2-1.1c.44.26.91.45 1.4.58l.62 2.2L12 21l.88-.08.62-2.2c.49-.13.96-.32 1.4-.58l2 1.1 1.77-1.76-1.1-2c.26-.44.45-.91.58-1.4l2.2-.62L21 12Z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.4"
                />
              </svg>
            </button>
          </div>
        </header>

        <div className="panel-body">{children}</div>
      </div>
    </main>
  )
}
