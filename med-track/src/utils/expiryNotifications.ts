import type { Medicine } from '../data/dashboardData'
import { calculateExpiry } from './expiryCalculator.ts'

export type ExpiryNotification = { id: string; medicineId: number; medicineName: string; status: 'EXPIRED' | 'EXPIRING_SOON' | 'EXPIRING'; daysRemaining: number | null }

export function collectNewExpiryNotifications(medicines: Medicine[], today: Date, seenKeys: Set<string>): ExpiryNotification[] {
  const detected: ExpiryNotification[] = []
  for (const medicine of medicines) {
    const result = calculateExpiry(medicine.expiryDate, today)
    if (result.status !== 'EXPIRED' && result.status !== 'EXPIRING_SOON' && result.status !== 'EXPIRING') continue
    const id = `${medicine.id}:${medicine.expiryDate}:${result.status}`
    if (seenKeys.has(id)) continue
    seenKeys.add(id)
    detected.push({ id, medicineId: medicine.id, medicineName: medicine.name, status: result.status, daysRemaining: result.daysRemaining })
  }
  return detected
}
