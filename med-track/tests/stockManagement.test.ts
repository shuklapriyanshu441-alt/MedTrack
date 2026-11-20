import test from 'node:test'
import assert from 'node:assert/strict'
import { initialMedicines } from '../src/data/dashboardData.ts'
import { createInitialReminders, enumerateScheduledOccurrences } from '../src/utils/reminderScheduler.ts'
import { adjustStock, applyDoseStockTransaction, correctDoseStockTransaction, doseUnitsPerOccurrence, getStockStatus, summarizeConsumption, summarizeStock, validateStockAdjustment, type StockMovement } from '../src/utils/stockManagement.ts'

const now = new Date('2026-11-20T12:00:00')
const medicine = initialMedicines[0]
const adjustment = { medicineId: medicine.id, type: 'add' as const, quantity: 5, reason: 'Refill', date: '2026-11-20' }

test('Stock status uses each threshold and distinguishes zero from low stock', () => {
  assert.equal(getStockStatus(8, 7), 'IN STOCK')
  assert.equal(getStockStatus(7, 7), 'LOW STOCK')
  assert.equal(getStockStatus(1, 7), 'LOW STOCK')
  assert.equal(getStockStatus(0, 7), 'OUT OF STOCK')
  assert.equal(getStockStatus(-1, 7), 'INVALID')
  assert.equal(getStockStatus(Number.NaN, 7), 'INVALID')
  assert.equal(getStockStatus(3, 3), 'LOW STOCK')
})

test('Stock additions, removals, corrections, and invalid quantities are recorded', () => {
  const added = adjustStock(initialMedicines, [], adjustment, now)
  assert.equal(added.medicines[0].quantity, medicine.quantity + 5)
  assert.equal(added.movements[0].movementType, 'Stock Added')
  assert.equal(added.movements[0].previousQuantity, medicine.quantity)
  const removed = adjustStock(added.medicines, added.movements, { ...adjustment, type: 'remove', quantity: 2 }, now)
  assert.equal(removed.medicines[0].quantity, medicine.quantity + 3)
  assert.equal(removed.movements[0].movementType, 'Stock Removed')
  const corrected = adjustStock(removed.medicines, removed.movements, { ...adjustment, type: 'correct', quantity: 0 }, now)
  assert.equal(corrected.medicines[0].quantity, 0)
  assert.equal(corrected.movements[0].movementType, 'Manual Correction')
  assert.match(adjustStock(initialMedicines, [], { ...adjustment, type: 'remove', quantity: medicine.quantity + 1 }, now).error ?? '', /not enough stock/)
  assert.ok(validateStockAdjustment({ ...adjustment, quantity: -1 }))
  assert.ok(validateStockAdjustment({ ...adjustment, date: '2026-02-31' }))
  assert.equal(adjustStock(initialMedicines, [], { ...adjustment, type: 'threshold', threshold: 12 }, now).medicines[0].lowStockThreshold, 12)
})

test('Taken dose atomically consumes stock once; skipped and missed do not', () => {
  const reminders = createInitialReminders(now)
  const reminder = { ...reminders[0], medicineId: medicine.id, reminderTimes: ['11:00'], dosage: '500 mg · 2 tablets' }
  const occurrence = enumerateScheduledOccurrences([reminder], initialMedicines, '2026-11-20', '2026-11-20', [], now)[0]
  assert.equal(doseUnitsPerOccurrence(reminder.dosage), 2)
  const skipped = applyDoseStockTransaction(initialMedicines, [], [], occurrence, 'SKIPPED', now.toISOString())
  assert.equal(skipped.medicines[0].quantity, medicine.quantity)
  assert.equal(skipped.movements.length, 0)
  const taken = applyDoseStockTransaction(initialMedicines, [], [], occurrence, 'TAKEN', now.toISOString())
  assert.equal(taken.medicines[0].quantity, medicine.quantity - 2)
  assert.equal(taken.records[0].status, 'TAKEN')
  assert.equal(taken.movements[0].movementType, 'Medicine Consumed')
  const missed = applyDoseStockTransaction(initialMedicines, [], [], occurrence, 'MISSED', now.toISOString())
  assert.equal(missed.medicines[0].quantity, medicine.quantity)
  assert.equal(missed.movements.length, 0)
  const duplicate = applyDoseStockTransaction(taken.medicines, taken.records, taken.movements, occurrence, 'TAKEN', now.toISOString())
  assert.equal(duplicate.medicines[0].quantity, taken.medicines[0].quantity)
  assert.equal(duplicate.movements.length, 1)
  const insufficientMeds = initialMedicines.map(item => item.id === medicine.id ? { ...item, quantity: 1 } : item)
  assert.match(applyDoseStockTransaction(insufficientMeds, [], [], occurrence, 'TAKEN', now.toISOString()).error ?? '', /needs 2/)
})

test('Dose corrections reverse consumption and reapply it when corrected to taken', () => {
  const reminder = { ...createInitialReminders(now)[0], medicineId: medicine.id, reminderTimes: ['11:00'], dosage: '1 capsule' }
  const occurrence = enumerateScheduledOccurrences([reminder], initialMedicines, '2026-11-20', '2026-11-20', [], now)[0]
  const taken = applyDoseStockTransaction(initialMedicines, [], [], occurrence, 'TAKEN', now.toISOString())
  const corrected = correctDoseStockTransaction(taken.medicines, taken.records, taken.movements, taken.records[0].id, 'SKIPPED', now.toISOString())
  assert.equal(corrected.medicines[0].quantity, medicine.quantity)
  assert.equal(corrected.records[0].status, 'SKIPPED')
  assert.equal(corrected.movements[0].movementType, 'Consumption Reversed')
  const emptyStock = corrected.medicines.map(item => item.id === medicine.id ? { ...item, quantity: 0 } : item)
  assert.match(correctDoseStockTransaction(emptyStock, corrected.records, corrected.movements, corrected.records[0].id, 'TAKEN', now.toISOString()).error ?? '', /available/)
  const retaken = correctDoseStockTransaction(corrected.medicines, corrected.records, corrected.movements, corrected.records[0].id, 'TAKEN', now.toISOString())
  assert.equal(retaken.medicines[0].quantity, medicine.quantity - 1)
  assert.equal(retaken.records[0].status, 'TAKEN')
  assert.equal(retaken.movements[0].movementType, 'Medicine Consumed')
})

test('Stock summaries and consumption analytics use actual movements and retain removed medicine names', () => {
  const movements: StockMovement[] = [{ id: 'm1', medicineId: 900, medicineName: 'Archived medicine', movementType: 'Medicine Consumed', quantityChanged: 3, previousQuantity: 10, newQuantity: 7, reason: 'Taken', timestamp: '2026-10-15T09:00:00.000Z', relatedDoseRecordId: 'dose-1' }, { id: 'm2', medicineId: 1, medicineName: medicine.name, movementType: 'Medicine Consumed', quantityChanged: 2, previousQuantity: 28, newQuantity: 26, reason: 'Taken', timestamp: '2026-11-15T09:00:00.000Z', relatedDoseRecordId: 'dose-2' }]
  assert.equal(summarizeStock(initialMedicines).totalUnits, initialMedicines.reduce((sum, item) => sum + item.quantity, 0))
  assert.equal(summarizeStock(initialMedicines).totalValue, null)
  assert.deepEqual(summarizeConsumption(movements, initialMedicines).monthly, [{ month: '2026-10', quantity: 3 }, { month: '2026-11', quantity: 2 }])
  assert.equal(summarizeConsumption(movements, initialMedicines).mostConsumed[0].medicine, 'Archived medicine')
})
