import type { Medicine } from '../data/dashboardData.ts'
import type { DoseOccurrence, DoseRecord, RecordedDoseStatus } from './reminderScheduler.ts'

export type StockStatus = 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK' | 'INVALID'
export type StockMovementType = 'Stock Added' | 'Stock Removed' | 'Manual Correction' | 'Medicine Consumed' | 'Consumption Reversed'
export interface StockMovement {
  id: string
  medicineId: number
  medicineName: string
  movementType: StockMovementType
  quantityChanged: number
  previousQuantity: number
  newQuantity: number
  reason: string
  timestamp: string
  relatedDoseRecordId: string | null
}
export interface StockAdjustment { medicineId: number; type: 'add' | 'remove' | 'correct' | 'threshold'; quantity: number; threshold?: number; reason: string; date: string }
export interface StockTransactionResult { medicines: Medicine[]; records: DoseRecord[]; movements: StockMovement[]; error?: string }
export type StockSummary = { totalMedicines: number; totalUnits: number; lowStock: number; outOfStock: number; totalValue: number | null }

export const DEFAULT_LOW_STOCK_THRESHOLD = 7
export function getStockStatus(quantity: number, threshold = DEFAULT_LOW_STOCK_THRESHOLD): StockStatus {
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(threshold) || threshold < 0) return 'INVALID'
  if (quantity === 0) return 'OUT OF STOCK'
  return quantity <= threshold ? 'LOW STOCK' : 'IN STOCK'
}
export function summarizeStock(medicines: Medicine[]): StockSummary {
  const values = medicines.map(item => item.purchasePrice)
  return { totalMedicines: medicines.length, totalUnits: medicines.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0), lowStock: medicines.filter(item => getStockStatus(item.quantity, item.lowStockThreshold) === 'LOW STOCK').length, outOfStock: medicines.filter(item => getStockStatus(item.quantity, item.lowStockThreshold) === 'OUT OF STOCK').length, totalValue: values.length && values.every(value => Number.isFinite(value)) ? medicines.reduce((sum, item) => sum + item.quantity * (item.purchasePrice ?? 0), 0) : null }
}
export function validateStockAdjustment(adjustment: StockAdjustment): string | null {
  if (!Number.isInteger(adjustment.medicineId)) return 'Select a medicine.'
  const dateParts = adjustment.date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const parsedDate = dateParts ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])) : null
  const validDate = Boolean(dateParts && parsedDate && parsedDate.getFullYear() === Number(dateParts[1]) && parsedDate.getMonth() + 1 === Number(dateParts[2]) && parsedDate.getDate() === Number(dateParts[3]))
  if (adjustment.type === 'threshold') return Number.isInteger(adjustment.threshold) && (adjustment.threshold ?? -1) >= 0 && adjustment.reason.trim() && validDate ? null : 'Enter a non-negative whole-number threshold, reason, and valid date.'
  if (!Number.isFinite(adjustment.quantity) || (adjustment.type === 'correct' ? adjustment.quantity < 0 : adjustment.quantity <= 0)) return adjustment.type === 'correct' ? 'Corrected quantity must be zero or greater.' : 'Quantity must be a positive number.'
  if (!adjustment.reason.trim()) return 'Enter a reason for this adjustment.'
  if (!validDate) return 'Choose a valid date.'
  return null
}
export function adjustStock(medicines: Medicine[], movements: StockMovement[], adjustment: StockAdjustment, now = new Date()): StockTransactionResult {
  const error = validateStockAdjustment(adjustment)
  if (error) return { medicines, records: [], movements, error }
  const medicine = medicines.find(item => item.id === adjustment.medicineId)
  if (!medicine) return { medicines, records: [], movements, error: 'This medicine is no longer in your cabinet.' }
  if (adjustment.type === 'threshold') {
    const movement: StockMovement = { id: `stock-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, medicineId: medicine.id, medicineName: medicine.name, movementType: 'Manual Correction', quantityChanged: 0, previousQuantity: medicine.quantity, newQuantity: medicine.quantity, reason: `Threshold updated to ${adjustment.threshold} · ${adjustment.reason.trim()}`, timestamp: new Date(`${adjustment.date}T${now.toTimeString().slice(0, 8)}`).toISOString(), relatedDoseRecordId: null }
    return { medicines: medicines.map(item => item.id === medicine.id ? { ...item, lowStockThreshold: adjustment.threshold! } : item), records: [], movements: [movement, ...movements] }
  }
  const next = adjustment.type === 'add' ? medicine.quantity + adjustment.quantity : adjustment.type === 'remove' ? medicine.quantity - adjustment.quantity : adjustment.quantity
  if (next < 0) return { medicines, records: [], movements, error: 'There is not enough stock for this removal.' }
  const movementType: StockMovementType = adjustment.type === 'add' ? 'Stock Added' : adjustment.type === 'remove' ? 'Stock Removed' : 'Manual Correction'
  const movement: StockMovement = { id: `stock-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, medicineId: medicine.id, medicineName: medicine.name, movementType, quantityChanged: Math.abs(next - medicine.quantity), previousQuantity: medicine.quantity, newQuantity: next, reason: adjustment.reason.trim(), timestamp: new Date(`${adjustment.date}T${now.toTimeString().slice(0, 8)}`).toISOString(), relatedDoseRecordId: null }
  return { medicines: medicines.map(item => item.id === medicine.id ? { ...item, quantity: next } : item), records: [], movements: [movement, ...movements] }
}
export function doseUnitsPerOccurrence(dosage: string): number {
  const match = dosage.match(/(?:·|\bx\b|\bof\b)\s*(\d+(?:\.\d+)?)\s*(?:tablets?|capsules?|softgels?|drops?|ml|units?|puffs?|sachets?)?/i)
    ?? dosage.match(/\b(\d+(?:\.\d+)?)\s*(?:tablets?|capsules?|softgels?|drops?|ml|units?|puffs?|sachets?)\b/i)
  const amount = match ? Number(match[1]) : 1
  return Number.isFinite(amount) && amount > 0 ? amount : 1
}
export function applyDoseStockTransaction(medicines: Medicine[], records: DoseRecord[], movements: StockMovement[], occurrence: DoseOccurrence, status: RecordedDoseStatus, completedAt = new Date().toISOString()): StockTransactionResult {
  if (records.some(record => record.id === occurrence.key)) return { medicines, records, movements }
  const medicine = medicines.find(item => item.id === occurrence.medicine.id)
  if (!medicine) return { medicines, records, movements, error: 'This medicine is no longer in your cabinet.' }
  const amount = doseUnitsPerOccurrence(occurrence.reminder.dosage)
  if (status === 'TAKEN' && medicine.quantity < amount) return { medicines, records, movements, error: `Only ${medicine.quantity} ${medicine.unit} available; this dose needs ${amount}. Add stock or correct the quantity before recording it as taken.` }
  const record: DoseRecord = { id: occurrence.key, reminderId: occurrence.reminder.id, medicineId: medicine.id, scheduledDateTime: occurrence.scheduledDateTime, dosage: occurrence.reminder.dosage, frequency: occurrence.reminder.frequency, status, completedAt: status === 'TAKEN' ? completedAt : null, notes: '', corrections: [] }
  if (status !== 'TAKEN') return { medicines, records: [...records, record], movements }
  const next = medicine.quantity - amount
  const movement: StockMovement = { id: `dose-${record.id}-${movements.length + 1}`, medicineId: medicine.id, medicineName: medicine.name, movementType: 'Medicine Consumed', quantityChanged: amount, previousQuantity: medicine.quantity, newQuantity: next, reason: `Dose taken · ${record.scheduledDateTime.replace('T', ' ')}`, timestamp: completedAt, relatedDoseRecordId: record.id }
  return { medicines: medicines.map(item => item.id === medicine.id ? { ...item, quantity: next } : item), records: [...records, record], movements: [movement, ...movements] }
}
export function correctDoseStockTransaction(medicines: Medicine[], records: DoseRecord[], movements: StockMovement[], recordId: string, status: RecordedDoseStatus, correctedAt = new Date().toISOString()): StockTransactionResult {
  const record = records.find(item => item.id === recordId)
  if (!record) return { medicines, records, movements, error: 'Dose record not found.' }
  if (record.status === status) return { medicines, records, movements }
  let nextMedicines = medicines
  let nextMovements = movements
  const consumed = movements.find(item => item.relatedDoseRecordId === recordId && item.movementType === 'Medicine Consumed')
  if (record.status === 'TAKEN' && status !== 'TAKEN' && consumed) {
    const medicine = medicines.find(item => item.id === record.medicineId)
    const priorQuantity = medicine?.quantity ?? consumed.newQuantity
    const restored = priorQuantity + consumed.quantityChanged
    if (medicine) nextMedicines = medicines.map(item => item.id === medicine.id ? { ...item, quantity: restored } : item)
    nextMovements = [{ id: `reverse-${recordId}`, medicineId: record.medicineId, medicineName: medicine?.name ?? consumed.medicineName, movementType: 'Consumption Reversed', quantityChanged: consumed.quantityChanged, previousQuantity: priorQuantity, newQuantity: restored, reason: `Dose corrected to ${status.toLowerCase()}`, timestamp: correctedAt, relatedDoseRecordId: recordId }, ...movements]
  } else if (record.status !== 'TAKEN' && status === 'TAKEN') {
    const medicine = medicines.find(item => item.id === record.medicineId)
    if (!medicine) return { medicines, records, movements, error: 'This medicine is no longer in your cabinet.' }
    const amount = doseUnitsPerOccurrence(record.dosage)
    if (medicine.quantity < amount) return { medicines, records, movements, error: `Only ${medicine.quantity} ${medicine.unit} available; this dose needs ${amount}. Add stock or correct the quantity first.` }
    const next = medicine.quantity - amount
    nextMedicines = medicines.map(item => item.id === medicine.id ? { ...item, quantity: next } : item)
    nextMovements = [{ id: `dose-${recordId}-${movements.length + 1}`, medicineId: medicine.id, medicineName: medicine.name, movementType: 'Medicine Consumed', quantityChanged: amount, previousQuantity: medicine.quantity, newQuantity: next, reason: 'Dose corrected to taken', timestamp: correctedAt, relatedDoseRecordId: recordId }, ...movements]
  }
  const nextRecords = records.map(item => item.id === recordId ? { ...item, status, completedAt: status === 'TAKEN' ? correctedAt : null, corrections: [...(item.corrections ?? []), { from: item.status, to: status, at: correctedAt }] } : item)
  return { medicines: nextMedicines, records: nextRecords, movements: nextMovements }
}
export function summarizeConsumption(movements: StockMovement[], medicines: Medicine[]) {
  const consumed = movements.filter(move => move.movementType === 'Medicine Consumed' || move.movementType === 'Consumption Reversed')
  const monthly = new Map<string, number>()
  const perMedicine = new Map<number, number>()
  consumed.forEach(move => { const delta = move.movementType === 'Consumption Reversed' ? -move.quantityChanged : move.quantityChanged; const date = new Date(move.timestamp); const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; monthly.set(month, (monthly.get(month) ?? 0) + delta); perMedicine.set(move.medicineId, (perMedicine.get(move.medicineId) ?? 0) + delta) })
  return { monthly: [...monthly].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, quantity]) => ({ month, quantity: Math.max(0, quantity) })), mostConsumed: [...perMedicine].filter(([, quantity]) => quantity > 0).map(([medicineId, quantity]) => ({ medicine: medicines.find(item => item.id === medicineId)?.name ?? movements.find(move => move.medicineId === medicineId)?.medicineName ?? 'Removed medicine', quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5) }
}
