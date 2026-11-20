import type { Medicine } from '../data/dashboardData.ts'
import type { DoseRecord, MedicineReminder } from '../utils/reminderScheduler.ts'
import type { StockMovement } from '../utils/stockManagement.ts'

export interface AppNotification {
  id: string
  type: 'expiry' | 'dose' | 'stock'
  medicineId: number | null
  medicineName: string
  message: string
  timestamp: string
  readAt: string | null
  status?: string
  daysRemaining?: number | null
  kind?: string
  dosage?: string
  scheduledDateTime?: string
}
export interface AppSettings {
  browserNotificationsEnabled: boolean
  expiryNotifications: boolean
  doseNotifications: boolean
  stockNotifications: boolean
  missedDoseGraceMinutes: number
  defaultLowStockThreshold: number
}
export interface ApplicationData {
  medicines: Medicine[]
  reminders: MedicineReminder[]
  doseRecords: DoseRecord[]
  stockMovements: StockMovement[]
  notifications: AppNotification[]
  settings: AppSettings
}
