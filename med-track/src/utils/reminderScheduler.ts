import type { Medicine } from '../data/dashboardData.ts'

export type ReminderFrequency = 'Once Daily' | 'Twice Daily' | 'Three Times Daily' | 'Custom Schedule'
export type DoseStatus = 'UPCOMING' | 'DUE' | 'TAKEN' | 'SKIPPED' | 'MISSED'
export type RecordedDoseStatus = Extract<DoseStatus, 'TAKEN' | 'SKIPPED' | 'MISSED'>
export const DEFAULT_MISSED_GRACE_MINUTES = 60
export const DEFAULT_APPROACHING_MINUTES = 15

export interface MedicineReminder {
  id: number
  medicineId: number
  dosage: string
  frequency: ReminderFrequency
  reminderTimes: string[]
  startDate: string
  endDate: string | null
  isActive: boolean
  createdAt: string
  pausedAt: string | null
  pauseHistory: { pausedAt: string; resumedAt: string }[]
}

export type MedicineReminderDraft = Omit<MedicineReminder, 'id' | 'createdAt' | 'isActive' | 'pausedAt' | 'pauseHistory'>
export type ReminderDraftErrors = Partial<Record<keyof MedicineReminderDraft, string>>

export interface DoseRecord {
  id: string
  reminderId: number
  medicineId: number
  scheduledDateTime: string
  dosage: string
  frequency: ReminderFrequency
  status: RecordedDoseStatus
  completedAt: string | null
  notes: string
  corrections: { from: RecordedDoseStatus; to: RecordedDoseStatus; at: string }[]
}

export interface DoseOccurrence {
  key: string
  reminder: MedicineReminder
  medicine: Medicine
  scheduledDateTime: string
  status: DoseStatus
  record: DoseRecord | null
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function shiftDateKey(value: string, offset: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  date.setDate(date.getDate() + offset)
  return dateKey(date)
}

export function scheduledDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const value = new Date(`${date}T${time}:00`)
  if (Number.isNaN(value.getTime()) || dateKey(value) !== date) return null
  return value
}

export function occurrenceKey(reminderId: number, scheduledAt: string): string {
  return `${reminderId}:${scheduledAt}`
}

export function calculateDoseStatus(scheduledAt: Date, now = new Date(), record?: DoseRecord | null, graceMinutes = DEFAULT_MISSED_GRACE_MINUTES): DoseStatus {
  if (record) return record.status
  const elapsedMinutes = (now.getTime() - scheduledAt.getTime()) / 60_000
  if (elapsedMinutes < 0) return 'UPCOMING'
  if (elapsedMinutes >= graceMinutes) return 'MISSED'
  return 'DUE'
}

export function requiredTimeCount(frequency: ReminderFrequency): number | null {
  if (frequency === 'Once Daily') return 1
  if (frequency === 'Twice Daily') return 2
  if (frequency === 'Three Times Daily') return 3
  return null
}

export function validateReminderDraft(draft: MedicineReminderDraft, medicines: Medicine[]): ReminderDraftErrors {
  const errors: ReminderDraftErrors = {}
  if (!medicines.some(medicine => medicine.id === draft.medicineId)) errors.medicineId = 'Choose an existing medicine.'
  if (!draft.dosage.trim()) errors.dosage = 'Enter the dose for each scheduled time.'
  if (!draft.frequency) errors.frequency = 'Choose a frequency.'
  const required = requiredTimeCount(draft.frequency)
  if (required !== null && draft.reminderTimes.length !== required) errors.reminderTimes = `Choose ${required} reminder time${required === 1 ? '' : 's'} for this frequency.`
  if (required === null && (draft.reminderTimes.length < 1 || draft.reminderTimes.length > 8)) errors.reminderTimes = 'Custom schedules need between 1 and 8 times.'
  if (draft.reminderTimes.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) errors.reminderTimes = 'Enter a valid time for every dose.'
  if (new Set(draft.reminderTimes).size !== draft.reminderTimes.length) errors.reminderTimes = 'Each reminder time must be unique.'
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  }
  if (!validDate(draft.startDate)) errors.startDate = 'Choose a valid start date.'
  if (draft.endDate && !validDate(draft.endDate)) errors.endDate = 'Choose a valid end date.'
  if (draft.endDate && validDate(draft.startDate) && validDate(draft.endDate) && draft.endDate < draft.startDate) errors.endDate = 'End date must be on or after the start date.'
  return errors
}

export function createInitialReminders(today = new Date()): MedicineReminder[] {
  const startDate = dateKey(today)
  const createdAt = today.toISOString()
  return [
    { id: 1001, medicineId: 2, dosage: '500 mg · 1 tablet', frequency: 'Once Daily', reminderTimes: ['08:00'], startDate, endDate: null, isActive: true, createdAt, pausedAt: null, pauseHistory: [] },
    { id: 1002, medicineId: 1, dosage: '1000 IU · 1 capsule', frequency: 'Once Daily', reminderTimes: ['09:00'], startDate, endDate: null, isActive: true, createdAt, pausedAt: null, pauseHistory: [] },
    { id: 1003, medicineId: 3, dosage: '1000 mg · 1 softgel', frequency: 'Once Daily', reminderTimes: ['13:00'], startDate, endDate: null, isActive: true, createdAt, pausedAt: null, pauseHistory: [] },
  ]
}

export function upsertReminder(reminders: MedicineReminder[], draft: MedicineReminderDraft, id?: number, newId = Date.now(), createdAt = new Date().toISOString()): MedicineReminder[] {
  const existing = reminders.find(reminder => reminder.id === id)
  const saved: MedicineReminder = { ...draft, id: existing?.id ?? newId, createdAt: existing?.createdAt ?? createdAt, isActive: existing?.isActive ?? true, pausedAt: existing?.pausedAt ?? null, pauseHistory: existing?.pauseHistory ?? [], reminderTimes: [...draft.reminderTimes] }
  return existing ? reminders.map(reminder => reminder.id === existing.id ? saved : reminder) : [saved, ...reminders]
}

export function removeReminder(reminders: MedicineReminder[], id: number): MedicineReminder[] {
  return reminders.filter(reminder => reminder.id !== id)
}

export function setReminderActive(reminders: MedicineReminder[], id: number, isActive: boolean, now = new Date()): MedicineReminder[] {
  return reminders.map(reminder => {
    if (reminder.id !== id || reminder.isActive === isActive) return reminder
    if (!isActive) return { ...reminder, isActive: false, pausedAt: now.toISOString() }
    const pauseHistory = reminder.pausedAt ? [...reminder.pauseHistory, { pausedAt: reminder.pausedAt, resumedAt: now.toISOString() }] : reminder.pauseHistory
    return { ...reminder, isActive: true, pausedAt: null, pauseHistory }
  })
}

export function enumerateScheduledOccurrences(reminders: MedicineReminder[], medicines: Medicine[], startDate: string, endDate: string, records: DoseRecord[], now = new Date(), graceMinutes = DEFAULT_MISSED_GRACE_MINUTES): DoseOccurrence[] {
  const medicineById = new Map(medicines.map(medicine => [medicine.id, medicine]))
  const recordsByKey = new Map(records.map(record => [occurrenceKey(record.reminderId, record.scheduledDateTime), record]))
  const occurrences: DoseOccurrence[] = []
  for (let day = startDate; day <= endDate; day = shiftDateKey(day, 1)) {
    for (const reminder of reminders) {
      if (day < reminder.startDate || (reminder.endDate && day > reminder.endDate)) continue
      const medicine = medicineById.get(reminder.medicineId)
      if (!medicine) continue
      for (const time of reminder.reminderTimes) {
        const scheduled = scheduledDateTime(day, time)
        if (!scheduled) continue
        const insidePastPause = reminder.pauseHistory.some(period => scheduled.getTime() > new Date(period.pausedAt).getTime() && scheduled.getTime() < new Date(period.resumedAt).getTime())
        if (insidePastPause || (!reminder.isActive && (!reminder.pausedAt || scheduled.getTime() > new Date(reminder.pausedAt).getTime()))) continue
        const scheduledAt = `${day}T${time}`
        const key = occurrenceKey(reminder.id, scheduledAt)
        const record = recordsByKey.get(key) ?? null
        occurrences.push({ key, reminder, medicine, scheduledDateTime: scheduledAt, status: calculateDoseStatus(scheduled, now, record, graceMinutes), record })
      }
    }
  }
  return occurrences.sort((a, b) => (scheduledDateTime(a.scheduledDateTime.slice(0, 10), a.scheduledDateTime.slice(11))?.getTime() ?? 0) - (scheduledDateTime(b.scheduledDateTime.slice(0, 10), b.scheduledDateTime.slice(11))?.getTime() ?? 0))
}

export function materializeMissedDoseRecords(reminders: MedicineReminder[], medicines: Medicine[], records: DoseRecord[], now = new Date(), graceMinutes = DEFAULT_MISSED_GRACE_MINUTES, lookbackDays = 30): DoseRecord[] {
  const from = shiftDateKey(dateKey(now), -lookbackDays)
  const through = dateKey(now)
  const existing = new Set(records.map(record => occurrenceKey(record.reminderId, record.scheduledDateTime)))
  const missed: DoseRecord[] = []
  for (const occurrence of enumerateScheduledOccurrences(reminders, medicines, from, through, records, now, graceMinutes)) {
    if (occurrence.status !== 'MISSED' || existing.has(occurrence.key)) continue
    existing.add(occurrence.key)
    missed.push({ id: occurrence.key, reminderId: occurrence.reminder.id, medicineId: occurrence.medicine.id, scheduledDateTime: occurrence.scheduledDateTime, dosage: occurrence.reminder.dosage, frequency: occurrence.reminder.frequency, status: 'MISSED', completedAt: null, notes: '', corrections: [] })
  }
  return missed.length ? [...records, ...missed] : records
}

export function recordDoseAction(records: DoseRecord[], occurrence: DoseOccurrence, status: RecordedDoseStatus, completedAt = new Date().toISOString(), notes = ''): DoseRecord[] {
  if (records.some(record => occurrenceKey(record.reminderId, record.scheduledDateTime) === occurrence.key)) return records
  const record: DoseRecord = { id: occurrence.key, reminderId: occurrence.reminder.id, medicineId: occurrence.medicine.id, scheduledDateTime: occurrence.scheduledDateTime, dosage: occurrence.reminder.dosage, frequency: occurrence.reminder.frequency, status, completedAt: status === 'TAKEN' ? completedAt : null, notes, corrections: [] }
  return [...records, record]
}

export function correctDoseRecord(records: DoseRecord[], recordId: string, status: RecordedDoseStatus, completedAt = new Date().toISOString()): DoseRecord[] {
  return records.map(record => record.id === recordId && record.status !== status ? { ...record, status, completedAt: status === 'TAKEN' ? completedAt : null, corrections: [...(record.corrections ?? []), { from: record.status, to: status, at: completedAt }] } : record)
}

export function doseHistoryStartDate(range: 'today' | '7days' | '30days' | 'all', today = new Date(), oldestRecordDate?: string): string {
  if (range === 'all' && oldestRecordDate) return oldestRecordDate.slice(0, 10)
  if (range === '7days') return shiftDateKey(dateKey(today), -6)
  if (range === '30days') return shiftDateKey(dateKey(today), -29)
  return dateKey(today)
}
