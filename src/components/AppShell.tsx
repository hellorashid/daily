import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { CalendarPopover } from './CalendarPopover'

type AppShellProps = {
  calendarSourceKey: string
  children: ReactNode
  currentDateKey: string
  disableDatePicker: boolean
  disableNoteActions: boolean
  disableNavigation: boolean
  disableNextNavigation: boolean
  isSettingsOpen: boolean
  maxDateKey: string
  onCopyContents: () => void
  onDateSelect: (dateKey: string) => void
  onNavigateNext: () => void
  onNavigatePrevious: () => void
  onOpenCurrentFile: () => void
  onOpenInFinder: () => void
  onSettingsToggle: () => void
  title: string
}

export function AppShell({
  calendarSourceKey,
  children,
  currentDateKey,
  disableDatePicker,
  disableNoteActions,
  disableNavigation,
  disableNextNavigation,
  isSettingsOpen,
  maxDateKey,
  onCopyContents,
  onDateSelect,
  onNavigateNext,
  onNavigatePrevious,
  onOpenCurrentFile,
  onOpenInFinder,
  onSettingsToggle,
  title,
}: AppShellProps) {
  const datePickerRef = useRef<HTMLDivElement | null>(null)
  const noteActionsRef = useRef<HTMLDivElement | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isNoteActionsOpen, setIsNoteActionsOpen] = useState(false)

  useEffect(() => {
    if (!isCalendarOpen && !isNoteActionsOpen) {
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

      if (!noteActionsRef.current?.contains(target)) {
        setIsNoteActionsOpen(false)
      }
    }

    function handleWindowBlur() {
      setIsCalendarOpen(false)
      setIsNoteActionsOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [isCalendarOpen, isNoteActionsOpen])

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
    if (disableNoteActions && isNoteActionsOpen) {
      const frame = window.requestAnimationFrame(() => {
        setIsNoteActionsOpen(false)
      })

      return () => {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [disableNoteActions, isNoteActionsOpen])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsCalendarOpen(false)
      setIsNoteActionsOpen(false)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [currentDateKey])

  function handleToggleDatePicker() {
    if (disableDatePicker) {
      return
    }

    setIsNoteActionsOpen(false)
    setIsCalendarOpen((current) => !current)
  }

  function handleToggleNoteActions() {
    if (disableNoteActions) {
      return
    }

    setIsCalendarOpen(false)
    setIsNoteActionsOpen((current) => !current)
  }

  function handleOpenCurrentFileClick() {
    if (disableNoteActions) {
      return
    }

    setIsNoteActionsOpen(false)
    onOpenCurrentFile()
  }

  function handleNoteAction(action: () => void) {
    setIsNoteActionsOpen(false)
    action()
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
                  dataSourceKey={calendarSourceKey}
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
            <div
              className="header-menu-wrap"
              onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
                event.stopPropagation()
              }}
              ref={noteActionsRef}
            >
              <div className={`header-split-button${isNoteActionsOpen ? ' active' : ''}${disableNoteActions ? ' disabled' : ''}`}>
                <button
                  aria-label="Open current note in default app"
                  className="header-split-button-primary"
                  disabled={disableNoteActions}
                  onClick={handleOpenCurrentFileClick}
                  type="button"
                >
                  <span className="header-split-button-mark">
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path
                        d="M7.5 4.5h6.1l3 3v10a2 2 0 0 1-2 2h-7.1a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.45"
                      />
                      <path
                        d="M13.6 4.5v3.1h3.1"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.45"
                      />
                    </svg>
                  </span>
                </button>
                <button
                  aria-expanded={isNoteActionsOpen}
                  aria-label="Open note actions"
                  className="header-split-button-toggle"
                  disabled={disableNoteActions}
                  onClick={handleToggleNoteActions}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path
                      d="m7.5 9.5 4.5 5 4.5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                    />
                  </svg>
                </button>
              </div>

              {isNoteActionsOpen ? (
                <div className="header-menu-dropdown" role="menu">
                  <button
                    className="header-menu-item"
                    onClick={() => {
                      handleNoteAction(onOpenCurrentFile)
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Open in Default App
                  </button>
                  <button
                    className="header-menu-item"
                    onClick={() => {
                      handleNoteAction(onOpenInFinder)
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Open in Finder
                  </button>
                  <button
                    className="header-menu-item"
                    onClick={() => {
                      handleNoteAction(onCopyContents)
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Copy Contents
                  </button>
                </div>
              ) : null}
            </div>
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
