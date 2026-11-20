export type ExpiryStatus = 'EXPIRED' | 'EXPIRING_SOON' | 'EXPIRING' | 'SAFE' | 'INVALID'
export type ExpiryResult = { status: ExpiryStatus; daysRemaining: number | null }
export type ExpirySort = 'earliest' | 'latest' | 'name' | 'days'

function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return Math.floor(date.getTime() / 86_400_000)
}

export function calculateDaysRemaining(expiryDate: string, today = new Date()): number | null {
  const expiryDay = calendarDay(expiryDate)
  if (expiryDay === null || Number.isNaN(today.getTime())) return null
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const todayDay = calendarDay(todayKey)
  return todayDay === null ? null : expiryDay - todayDay
}

export function calculateExpiry(expiryDate: string, today = new Date()): ExpiryResult {
  const daysRemaining = calculateDaysRemaining(expiryDate, today)
  if (daysRemaining === null) return { status: 'INVALID', daysRemaining: null }
  if (daysRemaining < 0) return { status: 'EXPIRED', daysRemaining }
  if (daysRemaining <= 7) return { status: 'EXPIRING_SOON', daysRemaining }
  if (daysRemaining <= 30) return { status: 'EXPIRING', daysRemaining }
  return { status: 'SAFE', daysRemaining }
}

export function compareExpiryDates(a: string, b: string): number {
  const aDay = calendarDay(a)
  const bDay = calendarDay(b)
  if (aDay === null && bDay === null) return 0
  if (aDay === null) return 1
  if (bDay === null) return -1
  return aDay - bDay
}

export function sortExpiryMedicines<T extends { name: string; expiryDate: string }>(medicines: T[], sort: ExpirySort, today = new Date()): T[] {
  return [...medicines].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'latest') {
      const aValid = calendarDay(a.expiryDate) !== null
      const bValid = calendarDay(b.expiryDate) !== null
      if (!aValid && !bValid) return 0
      if (!aValid) return 1
      if (!bValid) return -1
      return compareExpiryDates(b.expiryDate, a.expiryDate)
    }
    if (sort === 'days') {
      const aDays = calculateExpiry(a.expiryDate, today).daysRemaining
      const bDays = calculateExpiry(b.expiryDate, today).daysRemaining
      if (aDays === null) return 1
      if (bDays === null) return -1
      return aDays - bDays
    }
    return compareExpiryDates(a.expiryDate, b.expiryDate)
  })
}
