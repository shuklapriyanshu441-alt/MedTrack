import test from 'node:test'
import assert from 'node:assert/strict'
import { STORAGE_KEYS, readStorageValue, removeStorageValues, writeStorageBatch, writeStorageValue, type StorageLike } from '../src/services/storageService.ts'
import { buildDemoData, exportApplicationData, migrateApplicationData, normalizeDoseRecords, normalizeMedicines, parseApplicationDataImport } from '../src/utils/dataMigration.ts'

class MemoryStorage implements StorageLike {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}
const normalizeString = (value: unknown): string | null => typeof value === 'string' ? value : null

test('Storage service writes and loads values and returns defaults for missing keys', () => {
  const storage = new MemoryStorage()
  assert.deepEqual(readStorageValue(STORAGE_KEYS.settings, 'default', normalizeString, storage), { value: 'default', source: 'default' })
  assert.equal(writeStorageValue(STORAGE_KEYS.settings, 'persisted', storage), null)
  assert.deepEqual(readStorageValue(STORAGE_KEYS.settings, 'default', normalizeString, storage), { value: 'persisted', source: 'stored' })
})

test('Invalid JSON and invalid shapes fall back safely; storage failures are caught', () => {
  const storage = new MemoryStorage()
  storage.values.set(STORAGE_KEYS.medicines, '{broken')
  assert.match(readStorageValue(STORAGE_KEYS.medicines, [], normalizeMedicines, storage).error ?? '', /could not be read/)
  storage.values.set(STORAGE_KEYS.settings, JSON.stringify(5))
  assert.match(readStorageValue(STORAGE_KEYS.settings, 'default', normalizeString, storage).error ?? '', /invalid/)
  const unavailable: StorageLike = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('quota') }, removeItem: () => { throw new Error('blocked') } }
  assert.match(readStorageValue(STORAGE_KEYS.settings, 'default', normalizeString, unavailable).error ?? '', /unavailable/)
  assert.match(writeStorageValue(STORAGE_KEYS.settings, 'x', unavailable) ?? '', /full or unavailable/)
  assert.match(removeStorageValues(unavailable) ?? '', /Could not clear/)
})

test('Batch writes keep related state together and pending transactions recover on read', () => {
  const storage = new MemoryStorage()
  assert.equal(writeStorageBatch({ [STORAGE_KEYS.medicines]: [{ id: 1 }], [STORAGE_KEYS.doseRecords]: [{ id: 'd1' }], [STORAGE_KEYS.stockMovements]: [{ id: 's1' }] }, storage), null)
  assert.equal(storage.getItem(STORAGE_KEYS.doseRecords), '[{"id":"d1"}]')
  storage.values.set('meditrack_pending_transaction', JSON.stringify([{ key: STORAGE_KEYS.medicines, value: [{ id: 2 }] }, { key: STORAGE_KEYS.doseRecords, value: [{ id: 'd2' }] }]))
  const recovered = readStorageValue(STORAGE_KEYS.medicines, [], value => Array.isArray(value) ? value : null, storage).value as { id: number }[]
  assert.deepEqual(recovered, [{ id: 2 }])
  assert.equal(storage.getItem(STORAGE_KEYS.doseRecords), '[{"id":"d2"}]')
  assert.equal(storage.getItem('meditrack_pending_transaction'), null)
})

test('Migration defaults old thresholds, sanitizes corrupted rows, and deduplicates medicine and dose IDs', () => {
  const demo = buildDemoData()
  const duplicateMedicine = { ...demo.medicines[0], quantity: -3 }
  const medicines = normalizeMedicines([{ ...demo.medicines[0], lowStockThreshold: undefined }, { ...demo.medicines[0] }, duplicateMedicine])
  assert.equal(medicines?.length, 1)
  assert.equal(medicines?.[0].lowStockThreshold, 7)
  const dose = { id: 'dose-one', reminderId: 99, medicineId: 1, scheduledDateTime: '2026-11-20T08:00', dosage: '1 tablet', frequency: 'Once Daily', status: 'TAKEN', completedAt: null, notes: '' }
  assert.equal(normalizeDoseRecords([dose, { ...dose, id: 'duplicate-id' }, { ...dose, id: 'broken', scheduledDateTime: 'bad' }])?.length, 1)
})

test('Application export/import round-trips and invalid backups are rejected without partial data', () => {
  const data = buildDemoData()
  const exported = exportApplicationData(data, '2026-11-20T00:00:00.000Z')
  assert.deepEqual(parseApplicationDataImport(exported), data)
  assert.equal(parseApplicationDataImport('{not json'), null)
  assert.equal(parseApplicationDataImport(JSON.stringify({ format: 'other', version: 1, data })), null)
  const broken = JSON.parse(exported) as { data: Record<string, unknown> }
  broken.data.medicines = 'invalid'
  assert.equal(parseApplicationDataImport(JSON.stringify(broken)), null)
  assert.equal(migrateApplicationData(data)?.medicines.length, data.medicines.length)
})
