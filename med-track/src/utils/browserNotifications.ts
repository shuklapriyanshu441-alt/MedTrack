export type BrowserNotificationPermission = 'default' | 'granted' | 'denied' | 'unsupported'
export interface BrowserNotificationPermissionApi {
  permission: string
  requestPermission: () => Promise<string>
}

function normalizePermission(permission: string): BrowserNotificationPermission {
  return permission === 'granted' || permission === 'denied' ? permission : 'default'
}

export function readBrowserNotificationPermission(api?: BrowserNotificationPermissionApi | null): BrowserNotificationPermission {
  return api ? normalizePermission(api.permission) : 'unsupported'
}

export async function requestBrowserNotificationPermission(api?: BrowserNotificationPermissionApi | null): Promise<BrowserNotificationPermission> {
  if (!api) return 'unsupported'
  const current = normalizePermission(api.permission)
  if (current !== 'default') return current
  try { return normalizePermission(await api.requestPermission()) } catch { return 'denied' }
}
