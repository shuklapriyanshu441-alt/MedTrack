export const medicineCategories = ['Antibiotic', 'Pain Relief', 'Vitamin', 'Supplement', 'Allergy', 'Other'] as const
export const medicineTypes = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Cream', 'Other'] as const

export type MedicineCategory = typeof medicineCategories[number]
export type MedicineType = typeof medicineTypes[number]
export type MedicineStatus = 'Active' | 'Low stock' | 'Expiring soon' | 'Expiring' | 'Expired' | 'Invalid date'
import { calculateExpiry } from '../utils/expiryCalculator.ts'

export interface Medicine {
  id: number
  name: string
  category: MedicineCategory
  type: MedicineType
  quantity: number
  lowStockThreshold: number
  purchasePrice?: number
  unit: string
  expiryDate: string
  purchaseDate: string
  dosage: string
  frequency: string
  reminderTime: string
  manufacturer: string
  notes: string
  color: string
  initials: string
}

export const getMedicineStatus = (medicine: Medicine, now = new Date()): MedicineStatus => {
  const { status } = calculateExpiry(medicine.expiryDate, now)
  if (status === 'INVALID') return 'Invalid date'
  if (status === 'EXPIRED') return 'Expired'
  if (status === 'EXPIRING_SOON') return 'Expiring soon'
  if (status === 'EXPIRING') return 'Expiring'
  return medicine.quantity <= (medicine.lowStockThreshold ?? 7) ? 'Low stock' : 'Active'
}

export const isExpired = (medicine: Medicine, now = new Date()) => calculateExpiry(medicine.expiryDate, now).status === 'EXPIRED'
export const isExpiringSoon = (medicine: Medicine, now = new Date()) => calculateExpiry(medicine.expiryDate, now).status === 'EXPIRING_SOON'

export const formatDate = (isoDate: string) => {
  if (!isoDate) return '—'
  const date = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

export const initialMedicines: Medicine[] = [
  { id: 1, name: 'Vitamin D3', category: 'Vitamin', type: 'Capsule', quantity: 28, lowStockThreshold: 7, unit: 'capsules', expiryDate: '2026-12-18', purchaseDate: '2026-09-18', dosage: '1000 IU', frequency: 'Once daily', reminderTime: '09:00', manufacturer: 'Nature Made', notes: 'Take with breakfast.', color: 'lilac', initials: 'D₃' },
  { id: 2, name: 'Metformin', category: 'Other', type: 'Tablet', quantity: 12, lowStockThreshold: 7, unit: 'tablets', expiryDate: '2027-08-24', purchaseDate: '2026-10-24', dosage: '500 mg', frequency: 'Twice daily', reminderTime: '08:00', manufacturer: 'Ascend Laboratories', notes: 'Take with meals.', color: 'mint', initials: 'M' },
  { id: 3, name: 'Omega-3 Fish Oil', category: 'Supplement', type: 'Capsule', quantity: 45, lowStockThreshold: 7, unit: 'softgels', expiryDate: '2027-11-02', purchaseDate: '2026-10-02', dosage: '1000 mg', frequency: 'Once daily', reminderTime: '13:00', manufacturer: 'Nordic Naturals', notes: '', color: 'peach', initials: 'Ω' },
  { id: 4, name: 'Lisinopril', category: 'Other', type: 'Tablet', quantity: 6, lowStockThreshold: 7, unit: 'tablets', expiryDate: '2026-12-02', purchaseDate: '2026-10-14', dosage: '10 mg', frequency: 'Once daily', reminderTime: '08:00', manufacturer: 'Zydus Pharmaceuticals', notes: 'Refill soon.', color: 'blue', initials: 'L' },
  { id: 5, name: 'Magnesium Glycinate', category: 'Supplement', type: 'Capsule', quantity: 30, lowStockThreshold: 7, unit: 'capsules', expiryDate: '2027-02-08', purchaseDate: '2026-10-08', dosage: '200 mg', frequency: 'Once daily', reminderTime: '21:00', manufacturer: 'Pure Encapsulations', notes: 'Take before bed.', color: 'yellow', initials: 'Mg' },
  { id: 6, name: 'Cetirizine', category: 'Allergy', type: 'Tablet', quantity: 4, lowStockThreshold: 7, unit: 'tablets', expiryDate: '2027-05-30', purchaseDate: '2026-05-30', dosage: '10 mg', frequency: 'As needed', reminderTime: '', manufacturer: 'Kirkland Signature', notes: '', color: 'rose', initials: 'C' },
]

export const reminderList = [
  { time: '08:00 AM', title: 'Metformin', detail: '500 mg · 1 tablet', color: 'mint', done: true },
  { time: '09:00 AM', title: 'Vitamin D3', detail: '1000 IU · 1 capsule', color: 'lilac', done: false },
  { time: '01:00 PM', title: 'Omega-3 Fish Oil', detail: '1000 mg · 2 softgels', color: 'peach', done: false },
]

export const usage = [{ day: 'Mon', taken: 3, missed: 0 }, { day: 'Tue', taken: 4, missed: 1 }, { day: 'Wed', taken: 3, missed: 0 }, { day: 'Thu', taken: 5, missed: 0 }, { day: 'Fri', taken: 4, missed: 1 }, { day: 'Sat', taken: 3, missed: 0 }, { day: 'Sun', taken: 4, missed: 0 }]
export const trend = [{ month: 'Jun', value: 62 }, { month: 'Jul', value: 68 }, { month: 'Aug', value: 66 }, { month: 'Sep', value: 77 }, { month: 'Oct', value: 82 }, { month: 'Nov', value: 88 }]
