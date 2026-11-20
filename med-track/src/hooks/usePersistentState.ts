import { useEffect, useRef, useState } from 'react'
import { readStorageValue, writeStorageValue, type StorageKey } from '../services/storageService.ts'

export function usePersistentState<T>(key: StorageKey, fallback: T, normalize: (value: unknown) => T | null) {
  const initial = useRef<ReturnType<typeof readStorageValue<T>> | null>(null)
  if (!initial.current) initial.current = readStorageValue(key, fallback, normalize)
  const [value, setValue] = useState<T>(initial.current.value)
  const [error, setError] = useState<string | null>(initial.current.error ?? null)
  const serialized = useRef<string | null>(initial.current.source === 'stored' ? JSON.stringify(initial.current.value) : null)
  useEffect(() => {
    const next = JSON.stringify(value)
    if (serialized.current === next) return
    const failure = writeStorageValue(key, value)
    setError(failure)
    if (!failure) serialized.current = next
  }, [key, value])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return
      try {
        const normalized = normalize(JSON.parse(event.newValue))
        if (normalized !== null) { serialized.current = event.newValue; setValue(normalized); setError(null) }
      } catch { setError('A change from another tab could not be read.') }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, normalize])
  const markPersisted = (nextValue: T) => { serialized.current = JSON.stringify(nextValue); setError(null) }
  return { value, setValue, error, markPersisted }
}
