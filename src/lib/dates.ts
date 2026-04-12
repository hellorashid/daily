const headerFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatHeaderDate(date = new Date()) {
  return headerFormatter.format(date)
}

export function formatHeaderDateFromKey(dateKey: string) {
  return formatHeaderDate(parseDateKey(dateKey))
}

export function getTodayFileName(date = new Date()) {
  return `${toDateKey(date)}.md`
}

export function getTodayDateKey() {
  return getTodayFileName().replace('.md', '')
}

export function shiftDateKey(dateKey: string, deltaDays: number) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + deltaDays)
  return getTodayFileName(date).replace('.md', '')
}

export function shiftMonth(date: Date, deltaMonths: number) {
  return new Date(date.getFullYear(), date.getMonth() + deltaMonths, 1)
}

export function formatCalendarMonthLabel(date: Date) {
  return monthFormatter.format(date)
}

export function formatCalendarDayNumber(date: Date) {
  return date.getDate().toString()
}

export function buildCalendarGrid(monthDate: Date) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - monthStart.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return day
  })
}
