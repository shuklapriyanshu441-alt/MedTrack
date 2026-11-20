import test from 'node:test'
import assert from 'node:assert/strict'
import { readBrowserNotificationPermission, requestBrowserNotificationPermission, type BrowserNotificationPermissionApi } from '../src/utils/browserNotifications.ts'

test('Browser notification permission handles unsupported, default, granted, and denied states', async () => {
  assert.equal(readBrowserNotificationPermission(null), 'unsupported')
  assert.equal(readBrowserNotificationPermission({ permission: 'default', requestPermission: async () => 'granted' }), 'default')
  assert.equal(readBrowserNotificationPermission({ permission: 'granted', requestPermission: async () => 'granted' }), 'granted')
  assert.equal(readBrowserNotificationPermission({ permission: 'denied', requestPermission: async () => 'denied' }), 'denied')
  assert.equal(await requestBrowserNotificationPermission(null), 'unsupported')
})

test('Permission is requested only through the explicit request path and is not re-requested if resolved', async () => {
  let calls = 0
  const api: BrowserNotificationPermissionApi = { permission: 'default', requestPermission: async () => { calls += 1; return 'granted' } }
  assert.equal(calls, 0)
  assert.equal(await requestBrowserNotificationPermission(api), 'granted')
  assert.equal(calls, 1)
  const denied: BrowserNotificationPermissionApi = { permission: 'denied', requestPermission: async () => { calls += 1; return 'granted' } }
  assert.equal(await requestBrowserNotificationPermission(denied), 'denied')
  assert.equal(calls, 1)
  const failing: BrowserNotificationPermissionApi = { permission: 'default', requestPermission: async () => { throw new Error('blocked') } }
  assert.equal(await requestBrowserNotificationPermission(failing), 'denied')
})
