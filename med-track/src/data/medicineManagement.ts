import { getMedicineStatus, type Medicine } from './dashboardData.ts'

export type MedicineDraft = Omit<Medicine, 'id' | 'color' | 'initials' | 'lowStockThreshold'> & { lowStockThreshold?: number }
export type MedicineFilters = { query: string; category: string; expiry: string; stock: string; sort: 'name' | 'expiry' }
export type MedicineFormErrors = Partial<Record<keyof MedicineDraft, string>>

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return !Number.isNaN(date.getTime()) && localDate === value
}

export function validateMedicineDraft(draft: MedicineDraft): MedicineFormErrors {
  const errors: MedicineFormErrors = {}
  if (!draft.name.trim()) errors.name = 'Enter a medicine name.'
  if (!draft.category) errors.category = 'Choose a category.'
  if (!draft.type) errors.type = 'Choose a medicine type.'
  if (!Number.isFinite(Number(draft.quantity)) || Number(draft.quantity) < 0) errors.quantity = 'Quantity must be zero or a positive number.'
  if (!Number.isInteger(Number(draft.lowStockThreshold ?? 7)) || Number(draft.lowStockThreshold ?? 7) < 0) errors.lowStockThreshold = 'Threshold must be a non-negative whole number.'
  if (!draft.unit.trim()) errors.unit = 'Enter a unit.'
  if (!isValidDate(draft.expiryDate)) errors.expiryDate = 'Enter a valid expiry date.'
  if (!isValidDate(draft.purchaseDate)) errors.purchaseDate = 'Enter a valid purchase date.'
  if (!draft.dosage.trim()) errors.dosage = 'Enter a dosage.'
  if (!draft.frequency) errors.frequency = 'Choose a frequency.'
  return errors
}

export function upsertMedicine(medicines: Medicine[], draft: MedicineDraft, existingId?: number, newId = Date.now()): Medicine[] {
  const existing = medicines.find(medicine => medicine.id === existingId)
  const saved: Medicine = { ...draft, lowStockThreshold: draft.lowStockThreshold ?? existing?.lowStockThreshold ?? 7, id: existing?.id ?? newId, color: existing?.color ?? 'mint', initials: draft.name.trim().slice(0, 2) }
  return existing ? medicines.map(medicine => medicine.id === existing.id ? saved : medicine) : [saved, ...medicines]
}

export const removeMedicine = (medicines: Medicine[], id: number) => medicines.filter(medicine => medicine.id !== id)

export function filterAndSortMedicines(medicines: Medicine[], filters: MedicineFilters, now = new Date()): Medicine[] {
  return medicines.filter(medicine => {
    const status = getMedicineStatus(medicine, now)
    const matchesName = medicine.name.toLowerCase().includes(filters.query.trim().toLowerCase())
    const matchesCategory = filters.category === 'All categories' || medicine.category === filters.category
    const matchesExpiry = filters.expiry === 'All expiry statuses' || (filters.expiry === 'Expiring soon' && (status === 'Expiring soon' || status === 'Expiring')) || (filters.expiry === 'Expired' && status === 'Expired') || (filters.expiry === 'Not expiring' && status !== 'Expiring soon' && status !== 'Expiring' && status !== 'Expired' && status !== 'Invalid date')
    const threshold = medicine.lowStockThreshold ?? 7
    const matchesStock = filters.stock === 'All stock levels' || (filters.stock === 'Low stock' && medicine.quantity > 0 && medicine.quantity <= threshold) || (filters.stock === 'In stock' && medicine.quantity > threshold) || (filters.stock === 'Out of stock' && medicine.quantity === 0)
    return matchesName && matchesCategory && matchesExpiry && matchesStock
  }).sort((a, b) => filters.sort === 'expiry' ? a.expiryDate.localeCompare(b.expiryDate) : a.name.localeCompare(b.name))
}
