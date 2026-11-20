import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDaysRemaining, calculateExpiry, sortExpiryMedicines } from '../src/utils/expiryCalculator.ts'
import { initialMedicines } from '../src/data/dashboardData.ts'
import { collectNewExpiryNotifications } from '../src/utils/expiryNotifications.ts'

const today = new Date(2026, 10, 20, 23, 59, 59)
const isoFromOffset = (offset: number) => {
  const date = new Date(2026, 10, 20 + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

test('Expiry calculator handles expired, today, tomorrow, and the 7/30 day boundaries', () => {
  assert.deepEqual(calculateExpiry(isoFromOffset(-1), today), { status: 'EXPIRED', daysRemaining: -1 })
  assert.deepEqual(calculateExpiry(isoFromOffset(0), today), { status: 'EXPIRING_SOON', daysRemaining: 0 })
  assert.deepEqual(calculateExpiry(isoFromOffset(1), today), { status: 'EXPIRING_SOON', daysRemaining: 1 })
  assert.deepEqual(calculateExpiry(isoFromOffset(7), today), { status: 'EXPIRING_SOON', daysRemaining: 7 })
  assert.deepEqual(calculateExpiry(isoFromOffset(8), today), { status: 'EXPIRING', daysRemaining: 8 })
  assert.deepEqual(calculateExpiry(isoFromOffset(30), today), { status: 'EXPIRING', daysRemaining: 30 })
  assert.deepEqual(calculateExpiry(isoFromOffset(31), today), { status: 'SAFE', daysRemaining: 31 })
  assert.equal(calculateDaysRemaining(isoFromOffset(1), today), 1)
})

test('Expiry calculator marks invalid and impossible dates explicitly', () => {
  assert.deepEqual(calculateExpiry('not-a-date', today), { status: 'INVALID', daysRemaining: null })
  assert.deepEqual(calculateExpiry('2026-02-30', today), { status: 'INVALID', daysRemaining: null })
  assert.equal(calculateDaysRemaining('', today), null)
})

test('Expiry sort orders earliest, latest, name, and days remaining with invalid dates last', () => {
  const medicines = [
    { name: 'Beta', expiryDate: isoFromOffset(30) },
    { name: 'Zulu', expiryDate: isoFromOffset(7) },
    { name: 'Alpha', expiryDate: isoFromOffset(31) },
    { name: 'Unknown', expiryDate: 'bad-date' },
  ]
  assert.deepEqual(sortExpiryMedicines(medicines, 'earliest', today).map(item => item.name), ['Zulu', 'Beta', 'Alpha', 'Unknown'])
  assert.deepEqual(sortExpiryMedicines(medicines, 'latest', today).map(item => item.name), ['Alpha', 'Beta', 'Zulu', 'Unknown'])
  assert.deepEqual(sortExpiryMedicines(medicines, 'name', today).map(item => item.name), ['Alpha', 'Beta', 'Unknown', 'Zulu'])
  assert.deepEqual(sortExpiryMedicines(medicines, 'days', today).map(item => item.name), ['Zulu', 'Beta', 'Alpha', 'Unknown'])
})

test('Expiry notifications report approaching dates once and do not repeat on rerender', () => {
  const sample = [
    { ...initialMedicines[0], id: 901, name: 'Due today', expiryDate: isoFromOffset(0) },
    { ...initialMedicines[1], id: 902, name: 'Already expired', expiryDate: isoFromOffset(-2) },
    { ...initialMedicines[2], id: 903, name: 'Coming up', expiryDate: isoFromOffset(8) },
    { ...initialMedicines[3], id: 904, name: 'Far away', expiryDate: isoFromOffset(60) },
  ]
  const seen = new Set<string>()
  const firstDetection = collectNewExpiryNotifications(sample, today, seen)
  assert.deepEqual(firstDetection.map(item => item.status), ['EXPIRING_SOON', 'EXPIRED', 'EXPIRING'])
  assert.deepEqual(collectNewExpiryNotifications(sample, today, seen), [])
  const nextDay = new Date(2026, 10, 21, 10)
  assert.deepEqual(collectNewExpiryNotifications(sample, nextDay, seen).map(item => item.status), ['EXPIRED', 'EXPIRING_SOON'])
})
