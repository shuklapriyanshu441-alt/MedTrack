import type { DoseOccurrence } from './reminderScheduler.ts'
import { scheduledDateTime, DEFAULT_APPROACHING_MINUTES } from './reminderScheduler.ts'

export type DoseNotificationKind = 'APPROACHING' | 'DUE' | 'MISSED'
export interface DoseNotification {
  id: string
  occurrenceKey: string
  medicineId: number
  medicineName: string
  dosage: string
  scheduledDateTime: string
  kind: DoseNotificationKind
}

export function collectNewDoseNotifications(occurrences: DoseOccurrence[], now: Date, seenKeys: Set<string>, approachingMinutes = DEFAULT_APPROACHING_MINUTES): DoseNotification[] {
  const detected: DoseNotification[] = []
  for (const occurrence of occurrences) {
    let kind: DoseNotificationKind | null = null
    if (occurrence.status === 'DUE') kind = 'DUE'
    else if (occurrence.status === 'MISSED') kind = 'MISSED'
    else if (occurrence.status === 'UPCOMING') {
      const scheduled = scheduledDateTime(occurrence.scheduledDateTime.slice(0, 10), occurrence.scheduledDateTime.slice(11))
      if (scheduled && scheduled.getTime() > now.getTime() && scheduled.getTime() - now.getTime() <= approachingMinutes * 60_000) kind = 'APPROACHING'
    }
    if (!kind) continue
    const id = `${occurrence.key}:${kind}`
    if (seenKeys.has(id)) continue
    seenKeys.add(id)
    detected.push({ id, occurrenceKey: occurrence.key, medicineId: occurrence.medicine.id, medicineName: occurrence.medicine.name, dosage: occurrence.reminder.dosage, scheduledDateTime: occurrence.scheduledDateTime, kind })
  }
  return detected
}
