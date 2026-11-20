export const STORAGE_KEYS = {
  medicines: 'meditrack_medicines', reminders: 'meditrack_reminders', doseRecords: 'meditrack_dose_records',
  stockMovements: 'meditrack_stock_movements', notifications: 'meditrack_notifications', settings: 'meditrack_settings',
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]
export interface StorageReadResult<T> { value: T; source: 'stored' | 'default'; error?: string }
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const pendingTransactionKey = 'meditrack_pending_transaction'
const browserStorage = (): StorageLike | null => { try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null } }

function recoverPendingTransaction(storage: StorageLike) {
  try {
    const raw = storage.getItem(pendingTransactionKey)
    if (!raw) return
    const entries: unknown = JSON.parse(raw)
    if (!Array.isArray(entries)) { storage.removeItem(pendingTransactionKey); return }
    for (const entry of entries) if (entry && typeof entry === 'object' && 'key' in entry && 'value' in entry && typeof entry.key === 'string') storage.setItem(entry.key, JSON.stringify(entry.value))
    storage.removeItem(pendingTransactionKey)
  } catch { /* Keep the journal so a later startup can retry. */ }
}

export function readStorageValue<T>(key: StorageKey, fallback: T, normalize: (value: unknown) => T | null, storage = browserStorage()): StorageReadResult<T> {
  if (!storage) return { value: fallback, source: 'default' }
  recoverPendingTransaction(storage)
  let raw: string | null
  try { raw = storage.getItem(key) } catch { return { value: fallback, source: 'default', error: 'Browser storage is unavailable.' } }
  if (raw === null) return { value: fallback, source: 'default' }
  try {
    const parsed: unknown = JSON.parse(raw)
    const normalized = normalize(parsed)
    if (normalized !== null) return { value: normalized, source: 'stored' }
    return { value: fallback, source: 'default', error: 'Saved data was invalid and has been replaced with a safe default.' }
  } catch { return { value: fallback, source: 'default', error: 'Saved data could not be read and has been replaced with a safe default.' } }
}

export function writeStorageValue(key: StorageKey, value: unknown, storage = browserStorage()): string | null {
  if (!storage) return 'Browser storage is unavailable. Data will remain in memory for this session.'
  try { storage.setItem(key, JSON.stringify(value)); return null }
  catch { return 'Browser storage is full or unavailable. Recent changes may not persist after refresh.' }
}

export function writeStorageBatch(entries: Partial<Record<StorageKey, unknown>>, storage = browserStorage()): string | null {
  if (!storage) return 'Browser storage is unavailable. Data will remain in memory for this session.'
  const transaction = Object.entries(entries).filter((entry): entry is [StorageKey, unknown] => entry[1] !== undefined).map(([key, value]) => ({ key, value }))
  if (!transaction.length) return null
  try {
    storage.setItem(pendingTransactionKey, JSON.stringify(transaction))
    for (const entry of transaction) storage.setItem(entry.key, JSON.stringify(entry.value))
    storage.removeItem(pendingTransactionKey)
    return null
  } catch { return 'Browser storage is full or unavailable. The complete change could not be saved.' }
}

export function removeStorageValues(storage = browserStorage()): string | null {
  if (!storage) return 'Browser storage is unavailable.'
  try { Object.values(STORAGE_KEYS).forEach(key => storage.removeItem(key)); storage.removeItem(pendingTransactionKey); return null }
  catch { return 'Could not clear browser storage.' }
}

export function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
export function isArray(value: unknown): value is unknown[] { return Array.isArray(value) }
