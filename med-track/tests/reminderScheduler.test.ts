import test from 'node:test'
import assert from 'node:assert/strict'
import { initialMedicines } from '../src/data/dashboardData.ts'
import { collectNewDoseNotifications } from '../src/utils/doseNotifications.ts'
import { calculateDoseStatus, createInitialReminders, enumerateScheduledOccurrences, materializeMissedDoseRecords, recordDoseAction, correctDoseRecord, removeReminder, requiredTimeCount, setReminderActive, upsertReminder, validateReminderDraft, type DoseRecord, type MedicineReminderDraft } from '../src/utils/reminderScheduler.ts'

const day = '2026-11-20'
const now = new Date(2026, 10, 20, 9, 0)
const baseDraft: MedicineReminderDraft = { medicineId: initialMedicines[0].id, dosage: '1 capsule · 1000 IU', frequency: 'Once Daily', reminderTimes: ['10:00'], startDate: day, endDate: null }

test('Reminder CRUD creates, edits, pauses, resumes, and deletes schedules', () => {
  const added = upsertReminder([], baseDraft, undefined, 55, now.toISOString())
  assert.equal(added.length, 1)
  assert.equal(added[0].medicineId, initialMedicines[0].id)
  const edited = upsertReminder(added, { ...baseDraft, dosage: '2 capsules', reminderTimes: ['11:00'] }, 55, 56)
  assert.equal(edited.length, 1)
  assert.equal(edited[0].dosage, '2 capsules')
  assert.equal(edited[0].createdAt, now.toISOString())
  const paused = setReminderActive(edited, 55, false, now)
  assert.equal(paused[0].isActive, false)
  assert.equal(paused[0].pausedAt, now.toISOString())
  const resumed = setReminderActive(paused, 55, true, now)
  assert.equal(resumed[0].isActive, true)
  assert.equal(resumed[0].pausedAt, null)
  assert.deepEqual(resumed[0].pauseHistory, [{ pausedAt: now.toISOString(), resumedAt: now.toISOString() }])
  assert.equal(removeReminder(resumed, 55).length, 0)
  assert.equal(createInitialReminders(now).length, 3)
})

test('Reminder frequencies validate the expected number of daily times and medicine association', () => {
  assert.equal(requiredTimeCount('Once Daily'), 1)
  assert.equal(requiredTimeCount('Twice Daily'), 2)
  assert.equal(requiredTimeCount('Three Times Daily'), 3)
  assert.equal(requiredTimeCount('Custom Schedule'), null)
  assert.deepEqual(validateReminderDraft(baseDraft, initialMedicines), {})
  assert.equal(validateReminderDraft({ ...baseDraft, medicineId: 999 }, initialMedicines).medicineId, 'Choose an existing medicine.')
  assert.ok(validateReminderDraft({ ...baseDraft, frequency: 'Twice Daily' }, initialMedicines).reminderTimes)
  assert.ok(validateReminderDraft({ ...baseDraft, frequency: 'Custom Schedule', reminderTimes: ['10:00', '10:00'] }, initialMedicines).reminderTimes)
  assert.ok(validateReminderDraft({ ...baseDraft, endDate: '2026-11-19' }, initialMedicines).endDate)
})

test('Dose status transitions at its scheduled time and the configurable grace boundary', () => {
  const scheduled = new Date(2026, 10, 20, 10, 0)
  assert.equal(calculateDoseStatus(scheduled, new Date(2026, 10, 20, 9, 59)), 'UPCOMING')
  assert.equal(calculateDoseStatus(scheduled, scheduled), 'DUE')
  assert.equal(calculateDoseStatus(scheduled, new Date(2026, 10, 20, 10, 59)), 'DUE')
  assert.equal(calculateDoseStatus(scheduled, new Date(2026, 10, 20, 11, 0)), 'MISSED')
  assert.equal(calculateDoseStatus(scheduled, new Date(2026, 10, 20, 10, 30), undefined, 30), 'MISSED')
})

test('Date bounds and paused schedules control generated daily occurrences', () => {
  const reminder = { ...baseDraft, id: 70, isActive: true, createdAt: now.toISOString(), pausedAt: null, pauseHistory: [], reminderTimes: ['09:00', '10:00'] }
  assert.equal(enumerateScheduledOccurrences([reminder], initialMedicines, day, day, [], now).length, 2)
  assert.equal(enumerateScheduledOccurrences([{ ...reminder, startDate: '2026-11-21' }], initialMedicines, day, day, [], now).length, 0)
  assert.equal(enumerateScheduledOccurrences([{ ...reminder, endDate: '2026-11-19' }], initialMedicines, day, day, [], now).length, 0)
  assert.equal(enumerateScheduledOccurrences([{ ...reminder, endDate: day }], initialMedicines, day, day, [], now).length, 2)
  const paused = { ...reminder, isActive: false, pausedAt: new Date(2026, 10, 20, 9, 30).toISOString() }
  assert.deepEqual(enumerateScheduledOccurrences([paused], initialMedicines, day, day, [], now).map(item => item.scheduledDateTime), [`${day}T09:00`])
  const pauseAt = new Date(2026, 10, 20, 9, 30).toISOString()
  const resumeAt = new Date(2026, 10, 20, 9, 45).toISOString()
  const resumed = { ...reminder, reminderTimes: ['09:00', '09:35', '10:00'], pauseHistory: [{ pausedAt: pauseAt, resumedAt: resumeAt }] }
  assert.deepEqual(enumerateScheduledOccurrences([resumed], initialMedicines, day, day, [], now).map(item => item.scheduledDateTime), [`${day}T09:00`, `${day}T10:00`])
})

test('Taken and skipped actions create one dose record; changes require explicit correction', () => {
  const reminder = { ...baseDraft, id: 80, isActive: true, createdAt: now.toISOString(), pausedAt: null, pauseHistory: [] }
  const occurrence = enumerateScheduledOccurrences([reminder], initialMedicines, day, day, [], now)[0]
  const taken = recordDoseAction([], occurrence, 'TAKEN', now.toISOString())
  assert.equal(taken.length, 1)
  assert.equal(taken[0].status, 'TAKEN')
  assert.equal(taken[0].completedAt, now.toISOString())
  assert.equal(recordDoseAction(taken, occurrence, 'SKIPPED').length, 1)
  const corrected = correctDoseRecord(taken, taken[0].id, 'SKIPPED', now.toISOString())
  assert.equal(corrected[0].status, 'SKIPPED')
  assert.equal(corrected[0].completedAt, null)
  const skipped = recordDoseAction([], occurrence, 'SKIPPED')
  assert.equal(skipped[0].completedAt, null)
})

test('Missed doses materialize once and dose notifications deduplicate across status changes', () => {
  const reminder = { ...baseDraft, id: 90, isActive: true, createdAt: now.toISOString(), pausedAt: null, pauseHistory: [] }
  const atEleven = new Date(2026, 10, 20, 11, 0)
  const missed: DoseRecord[] = materializeMissedDoseRecords([reminder], initialMedicines, [], atEleven)
  assert.equal(missed.length, 1)
  assert.equal(missed[0].status, 'MISSED')
  assert.equal(materializeMissedDoseRecords([reminder], initialMedicines, missed, atEleven), missed)

  const seen = new Set<string>()
  const approaching = enumerateScheduledOccurrences([reminder], initialMedicines, day, day, [], new Date(2026, 10, 20, 9, 50))
  assert.deepEqual(collectNewDoseNotifications(approaching, new Date(2026, 10, 20, 9, 50), seen).map(item => item.kind), ['APPROACHING'])
  assert.deepEqual(collectNewDoseNotifications(approaching, new Date(2026, 10, 20, 9, 51), seen), [])
  const due = enumerateScheduledOccurrences([reminder], initialMedicines, day, day, [], new Date(2026, 10, 20, 10, 0))
  assert.deepEqual(collectNewDoseNotifications(due, new Date(2026, 10, 20, 10, 0), seen).map(item => item.kind), ['DUE'])
  const missedOccurrence = enumerateScheduledOccurrences([reminder], initialMedicines, day, day, missed, atEleven)
  assert.deepEqual(collectNewDoseNotifications(missedOccurrence, atEleven, seen).map(item => item.kind), ['MISSED'])
})
