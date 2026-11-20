import { initialMedicines, medicineCategories, medicineTypes, type Medicine } from '../data/dashboardData.ts'
import { createInitialReminders, type DoseRecord, type MedicineReminder, type ReminderFrequency, type RecordedDoseStatus } from './reminderScheduler.ts'
import { isArray, isRecord } from '../services/storageService.ts'
import type { StockMovement } from './stockManagement.ts'
import type { AppNotification, AppSettings, ApplicationData } from '../types/applicationData.ts'

export const defaultAppSettings: AppSettings = { browserNotificationsEnabled: false, expiryNotifications: true, doseNotifications: true, stockNotifications: true, missedDoseGraceMinutes: 60, defaultLowStockThreshold: 7 }
const validCategory = (value: unknown) => medicineCategories.includes(value as typeof medicineCategories[number])
const validType = (value: unknown) => medicineTypes.includes(value as typeof medicineTypes[number])
const validDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number); const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function normalizeMedicines(value: unknown): Medicine[] | null {
  if (!isArray(value)) return null
  const ids = new Set<number>()
  const result: Medicine[] = []
  value.forEach(item => {
    if (!isRecord(item) || !Number.isInteger(item.id) || typeof item.name !== 'string' || !item.name.trim() || !validCategory(item.category) || !validType(item.type) || !Number.isFinite(item.quantity) || (item.quantity as number) < 0) return
    const id = item.id as number
    if (ids.has(id)) return
    const requiredText = ['unit', 'expiryDate', 'purchaseDate', 'dosage', 'frequency', 'reminderTime', 'manufacturer', 'notes', 'color', 'initials']
    if (requiredText.some(key => typeof item[key] !== 'string') || !validDate(item.expiryDate) || !validDate(item.purchaseDate)) return
    const threshold = Number.isInteger(item.lowStockThreshold) && (item.lowStockThreshold as number) >= 0 ? item.lowStockThreshold as number : 7
    const price = typeof item.purchasePrice === 'number' && Number.isFinite(item.purchasePrice) && item.purchasePrice >= 0 ? item.purchasePrice : undefined
    ids.add(id)
    const normalized = { ...(item as unknown as Medicine), lowStockThreshold: threshold }
    if (price !== undefined) normalized.purchasePrice = price
    else delete normalized.purchasePrice
    result.push(normalized)
  })
  return result
}

export function normalizeReminders(value: unknown, medicines?: Medicine[]): MedicineReminder[] | null {
  if (!isArray(value)) return null
  const ids = new Set<number>(); const medicineIds = new Set((medicines ?? []).map(m => m.id)); const result: MedicineReminder[] = []
  value.forEach(item => {
    if (!isRecord(item) || !Number.isInteger(item.id) || !Number.isInteger(item.medicineId) || (medicines && !medicineIds.has(item.medicineId as number)) || typeof item.dosage !== 'string' || !item.dosage.trim() || !['Once Daily', 'Twice Daily', 'Three Times Daily', 'Custom Schedule'].includes(String(item.frequency)) || !Array.isArray(item.reminderTimes) || item.reminderTimes.length < 1 || !item.reminderTimes.every(time => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) || !validDate(item.startDate) || (item.endDate !== null && !validDate(item.endDate)) || typeof item.isActive !== 'boolean' || typeof item.createdAt !== 'string') return
    const id = item.id as number
    if (ids.has(id)) return
    ids.add(id)
    result.push({ ...(item as unknown as MedicineReminder), pausedAt: typeof item.pausedAt === 'string' ? item.pausedAt : null, pauseHistory: Array.isArray(item.pauseHistory) ? item.pauseHistory.filter(isRecord).filter(period => typeof period.pausedAt === 'string' && typeof period.resumedAt === 'string') as { pausedAt: string; resumedAt: string }[] : [] })
  })
  return result
}

export function normalizeDoseRecords(value: unknown): DoseRecord[] | null {
  if (!isArray(value)) return null
  const ids = new Set<string>(); const result: DoseRecord[] = []
  value.forEach(item => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.reminderId !== 'number' || typeof item.medicineId !== 'number' || typeof item.scheduledDateTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(item.scheduledDateTime) || typeof item.dosage !== 'string' || !['TAKEN', 'SKIPPED', 'MISSED'].includes(String(item.status))) return
    const occurrence = `${item.reminderId}:${item.scheduledDateTime}`
    if (ids.has(occurrence) || ids.has(item.id)) return
    ids.add(occurrence); ids.add(item.id)
    const corrections = Array.isArray(item.corrections) ? item.corrections.filter(isRecord).filter(entry => ['TAKEN', 'SKIPPED', 'MISSED'].includes(String(entry.from)) && ['TAKEN', 'SKIPPED', 'MISSED'].includes(String(entry.to)) && typeof entry.at === 'string').map(entry => ({ from: entry.from as RecordedDoseStatus, to: entry.to as RecordedDoseStatus, at: entry.at as string })) : []
    result.push({ id: item.id, reminderId: item.reminderId as number, medicineId: item.medicineId as number, scheduledDateTime: item.scheduledDateTime, dosage: item.dosage, frequency: (typeof item.frequency === 'string' ? item.frequency : 'Once Daily') as ReminderFrequency, status: item.status as DoseRecord['status'], completedAt: typeof item.completedAt === 'string' ? item.completedAt : null, notes: typeof item.notes === 'string' ? item.notes : '', corrections })
  })
  return result
}

const movementTypes = ['Stock Added', 'Stock Removed', 'Manual Correction', 'Medicine Consumed', 'Consumption Reversed']
export function normalizeStockMovements(value: unknown): StockMovement[] | null {
  if (!isArray(value)) return null
  const ids = new Set<string>(); const result: StockMovement[] = []
  value.forEach(item => {
    if (!isRecord(item) || typeof item.id !== 'string' || !Number.isInteger(item.medicineId) || typeof item.medicineName !== 'string' || !movementTypes.includes(String(item.movementType)) || !Number.isFinite(item.quantityChanged) || !Number.isFinite(item.previousQuantity) || !Number.isFinite(item.newQuantity) || typeof item.reason !== 'string' || typeof item.timestamp !== 'string') return
    if (ids.has(item.id)) return
    ids.add(item.id)
    result.push({ id: item.id, medicineId: item.medicineId as number, medicineName: item.medicineName, movementType: item.movementType as StockMovement['movementType'], quantityChanged: item.quantityChanged as number, previousQuantity: item.previousQuantity as number, newQuantity: item.newQuantity as number, reason: item.reason, timestamp: item.timestamp, relatedDoseRecordId: typeof item.relatedDoseRecordId === 'string' ? item.relatedDoseRecordId : null })
  })
  return result
}

export function normalizeNotifications(value: unknown): AppNotification[] | null {
  if (!isArray(value)) return null
  const ids = new Set<string>(); const result: AppNotification[] = []
  value.forEach(item => {
    if (!isRecord(item) || typeof item.id !== 'string' || !['expiry', 'dose', 'stock'].includes(String(item.type)) || typeof item.medicineName !== 'string' || typeof item.message !== 'string' || typeof item.timestamp !== 'string') return
    if (ids.has(item.id)) return
    ids.add(item.id)
    result.push({ id: item.id, type: item.type as AppNotification['type'], medicineId: typeof item.medicineId === 'number' ? item.medicineId : null, medicineName: item.medicineName, message: item.message, timestamp: item.timestamp, readAt: typeof item.readAt === 'string' ? item.readAt : null, status: typeof item.status === 'string' ? item.status : undefined, daysRemaining: typeof item.daysRemaining === 'number' ? item.daysRemaining : null, kind: typeof item.kind === 'string' ? item.kind : undefined, dosage: typeof item.dosage === 'string' ? item.dosage : undefined, scheduledDateTime: typeof item.scheduledDateTime === 'string' ? item.scheduledDateTime : undefined })
  })
  return result
}

export function normalizeSettings(value: unknown): AppSettings | null {
  if (!isRecord(value)) return null
  const grace = Number(value.missedDoseGraceMinutes); const threshold = Number(value.defaultLowStockThreshold)
  return { browserNotificationsEnabled: value.browserNotificationsEnabled === true, expiryNotifications: value.expiryNotifications !== false, doseNotifications: value.doseNotifications !== false, stockNotifications: value.stockNotifications !== false, missedDoseGraceMinutes: [15, 30, 60, 90, 120].includes(grace) ? grace : 60, defaultLowStockThreshold: Number.isInteger(threshold) && threshold >= 0 && threshold <= 10000 ? threshold : 7 }
}

export function buildDemoData(): ApplicationData {
  const medicines = initialMedicines.map(medicine => ({ ...medicine, lowStockThreshold: 7 }))
  return { medicines, reminders: createInitialReminders(), doseRecords: [], stockMovements: [], notifications: [], settings: defaultAppSettings }
}

export function migrateApplicationData(raw: unknown): ApplicationData | null {
  if (!isRecord(raw)) return null
  const payload = isRecord(raw.data) ? raw.data : raw
  const medicines = normalizeMedicines(payload.medicines)
  const reminders = normalizeReminders(payload.reminders, medicines ?? [])
  const doseRecords = normalizeDoseRecords(payload.doseRecords)
  const stockMovements = normalizeStockMovements(payload.stockMovements)
  const notifications = normalizeNotifications(payload.notifications)
  const settings = normalizeSettings(payload.settings)
  if (!medicines || !reminders || !doseRecords || !stockMovements || !notifications || !settings) return null
  return { medicines, reminders, doseRecords, stockMovements, notifications, settings }
}

export function exportApplicationData(data: ApplicationData, exportedAt = new Date().toISOString()): string {
  return JSON.stringify({ format: 'meditrack-export', version: 1, exportedAt, data }, null, 2)
}
export function parseApplicationDataImport(text: string): ApplicationData | null {
  try { const parsed: unknown = JSON.parse(text); if (!isRecord(parsed) || parsed.format !== 'meditrack-export' || parsed.version !== 1) return null; return migrateApplicationData(parsed) } catch { return null }
}

export const isMedicineList = (value: unknown): value is Medicine[] => normalizeMedicines(value) !== null
export const isReminderList = (value: unknown): value is MedicineReminder[] => normalizeReminders(value) !== null
export const isDoseRecordList = (value: unknown): value is DoseRecord[] => normalizeDoseRecords(value) !== null
export const isStockMovementList = (value: unknown): value is StockMovement[] => normalizeStockMovements(value) !== null
export const isNotificationList = (value: unknown): value is AppNotification[] => normalizeNotifications(value) !== null
export const isSettings = (value: unknown): value is AppSettings => normalizeSettings(value) !== null
