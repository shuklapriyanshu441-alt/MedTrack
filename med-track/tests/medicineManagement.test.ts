import test from 'node:test'
import assert from 'node:assert/strict'
import { initialMedicines, type Medicine } from '../src/data/dashboardData.ts'
import { filterAndSortMedicines, removeMedicine, upsertMedicine, validateMedicineDraft, type MedicineDraft } from '../src/data/medicineManagement.ts'

const first = initialMedicines[0]
const toDraft = (medicine: Medicine): MedicineDraft => ({ name: medicine.name, category: medicine.category, type: medicine.type, quantity: medicine.quantity, unit: medicine.unit, expiryDate: medicine.expiryDate, purchaseDate: medicine.purchaseDate, dosage: medicine.dosage, frequency: medicine.frequency, reminderTime: medicine.reminderTime, manufacturer: medicine.manufacturer, notes: medicine.notes })
const now = new Date('2026-11-20T12:00:00')

test('Add, edit, and delete medicine update the inventory', () => {
  const draft = { ...toDraft(first), name: 'Amoxicillin', category: 'Antibiotic' as const, quantity: 18 }
  const added = upsertMedicine(initialMedicines, draft, undefined, 999)
  assert.equal(added.length, initialMedicines.length + 1)
  assert.equal(added[0].name, 'Amoxicillin')
  const edited = upsertMedicine(added, { ...draft, quantity: 9, dosage: '250 mg' }, 999, 1000)
  assert.equal(edited.length, added.length)
  assert.equal(edited[0].quantity, 9)
  assert.equal(edited[0].dosage, '250 mg')
  assert.equal(edited[0].id, 999)
  const deleted = removeMedicine(edited, 999)
  assert.equal(deleted.length, initialMedicines.length)
  assert.ok(!deleted.some(medicine => medicine.id === 999))
})

test('Search, category, expiry, stock filters, and sorting work', () => {
  const base = { query: '', category: 'All categories', expiry: 'All expiry statuses', stock: 'All stock levels', sort: 'name' as const }
  assert.deepEqual(filterAndSortMedicines(initialMedicines, { ...base, query: 'vitamin' }, now).map(m => m.name), ['Vitamin D3'])
  assert.ok(filterAndSortMedicines(initialMedicines, { ...base, category: 'Allergy' }, now).every(m => m.category === 'Allergy'))
  assert.equal(filterAndSortMedicines(initialMedicines, { ...base, expiry: 'Expiring soon' }, now).length, 2)
  const expired = { ...first, id: 777, name: 'Old medicine', expiryDate: '2026-01-01' }
  assert.equal(filterAndSortMedicines([...initialMedicines, expired], { ...base, expiry: 'Expired' }, now)[0].name, 'Old medicine')
  assert.ok(filterAndSortMedicines(initialMedicines, { ...base, stock: 'Low stock' }, now).every(m => m.quantity <= 7))
  assert.ok(filterAndSortMedicines(initialMedicines, { ...base, stock: 'In stock' }, now).every(m => m.quantity > 7))
  const byExpiry = filterAndSortMedicines(initialMedicines, { ...base, sort: 'expiry' }, now)
  assert.equal(byExpiry[0].name, 'Lisinopril')
  const byName = filterAndSortMedicines(initialMedicines, base, now)
  assert.equal(byName[0].name, 'Cetirizine')
})

test('Form validation catches missing fields, invalid quantities, and impossible dates', () => {
  const valid = toDraft(first)
  assert.deepEqual(validateMedicineDraft(valid), {})
  assert.equal(validateMedicineDraft({ ...valid, name: '  ' }).name, 'Enter a medicine name.')
  assert.equal(validateMedicineDraft({ ...valid, dosage: '' }).dosage, 'Enter a dosage.')
  assert.equal(validateMedicineDraft({ ...valid, quantity: -1 }).quantity, 'Quantity must be zero or a positive number.')
  assert.equal(validateMedicineDraft({ ...valid, expiryDate: '2026-02-31' }).expiryDate, 'Enter a valid expiry date.')
  assert.equal(validateMedicineDraft({ ...valid, purchaseDate: '' }).purchaseDate, 'Enter a valid purchase date.')
})
