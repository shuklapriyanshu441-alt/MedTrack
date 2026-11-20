import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Ellipsis, LayoutDashboard, Menu, MoreHorizontal, Package, Plus, Search, Settings, ShieldCheck, Sparkles, Tablets, Pencil, Trash2, Pill, ChartNoAxesCombined, BellRing, HeartPulse, AlertCircle, Boxes, CircleDollarSign } from 'lucide-react'
import { formatDate, getMedicineStatus, type Medicine } from './data/dashboardData'
import { calculateExpiry } from './utils/expiryCalculator'
import { collectNewExpiryNotifications } from './utils/expiryNotifications'
import { filterAndSortMedicines, removeMedicine, upsertMedicine, type MedicineDraft } from './data/medicineManagement'
import MedicineFormModal from './components/MedicineFormModal'
import MedicineDetailsModal from './components/MedicineDetailsModal'
import DeleteMedicineDialog from './components/DeleteMedicineDialog'
import { collectNewDoseNotifications } from './utils/doseNotifications'
import { readBrowserNotificationPermission, requestBrowserNotificationPermission, type BrowserNotificationPermission } from './utils/browserNotifications'
import { dateKey, enumerateScheduledOccurrences, materializeMissedDoseRecords, removeReminder, setReminderActive, shiftDateKey, upsertReminder, type DoseOccurrence, type DoseRecord, type MedicineReminderDraft, type RecordedDoseStatus } from './utils/reminderScheduler'
import { applyDoseStockTransaction, adjustStock, correctDoseStockTransaction, getStockStatus, summarizeStock, type StockAdjustment, type StockMovement } from './utils/stockManagement'
import { usePersistentState } from './hooks/usePersistentState'
import { STORAGE_KEYS, writeStorageBatch, type StorageKey } from './services/storageService'
import { buildDemoData, defaultAppSettings, normalizeMedicines, normalizeReminders, normalizeDoseRecords, normalizeStockMovements, normalizeNotifications, normalizeSettings } from './utils/dataMigration'
import type { AppNotification, ApplicationData } from './types/applicationData'
import './App.css'

const ExpiryTracker = lazy(() => import('./pages/ExpiryTracker'))
const Reminders = lazy(() => import('./pages/Reminders'))
const Inventory = lazy(() => import('./pages/Inventory'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const DashboardAnalytics = lazy(() => import('./components/DashboardAnalytics'))
const demoData = buildDemoData()

const navigationItems = [
  { label: 'Dashboard', icon: LayoutDashboard }, { label: 'My medicines', icon: Tablets },
  { label: 'Reminders', icon: BellRing }, { label: 'Expiry tracker', icon: CalendarDays, dot: true },
  { label: 'Inventory', icon: Package }, { label: 'Analytics', icon: ChartNoAxesCombined },
]

function App() {
  const medicineStore = usePersistentState(STORAGE_KEYS.medicines, demoData.medicines, normalizeMedicines)
  const reminderStore = usePersistentState(STORAGE_KEYS.reminders, demoData.reminders, value => normalizeReminders(value))
  const doseStore = usePersistentState(STORAGE_KEYS.doseRecords, demoData.doseRecords, normalizeDoseRecords)
  const movementStore = usePersistentState(STORAGE_KEYS.stockMovements, demoData.stockMovements, normalizeStockMovements)
  const notificationStore = usePersistentState(STORAGE_KEYS.notifications, demoData.notifications, normalizeNotifications)
  const settingsStore = usePersistentState(STORAGE_KEYS.settings, demoData.settings, normalizeSettings)
  const medicines = medicineStore.value; const setMedicines = medicineStore.setValue
  const reminders = reminderStore.value; const setReminders = reminderStore.setValue
  const doseRecords = doseStore.value; const setDoseRecords = doseStore.setValue
  const stockMovements = movementStore.value; const setStockMovements = movementStore.setValue
  const storedNotifications = notificationStore.value; const setNotifications = notificationStore.setValue
  const settings = settingsStore.value; const setSettings = settingsStore.setValue
  const [transactionStorageError, setTransactionStorageError] = useState<string | null>(null)
  const persistBatch = (entries: Partial<Record<StorageKey, unknown>>) => {
    const failure = writeStorageBatch(entries)
    setTransactionStorageError(failure)
    if (failure) return false
    if (entries[STORAGE_KEYS.medicines] !== undefined) medicineStore.markPersisted(entries[STORAGE_KEYS.medicines] as Medicine[])
    if (entries[STORAGE_KEYS.reminders] !== undefined) reminderStore.markPersisted(entries[STORAGE_KEYS.reminders] as typeof reminders)
    if (entries[STORAGE_KEYS.doseRecords] !== undefined) doseStore.markPersisted(entries[STORAGE_KEYS.doseRecords] as DoseRecord[])
    if (entries[STORAGE_KEYS.stockMovements] !== undefined) movementStore.markPersisted(entries[STORAGE_KEYS.stockMovements] as StockMovement[])
    if (entries[STORAGE_KEYS.notifications] !== undefined) notificationStore.markPersisted(entries[STORAGE_KEYS.notifications] as AppNotification[])
    if (entries[STORAGE_KEYS.settings] !== undefined) settingsStore.markPersisted(entries[STORAGE_KEYS.settings] as typeof settings)
    return true
  }
  const storageError = transactionStorageError ?? medicineStore.error ?? reminderStore.error ?? doseStore.error ?? movementStore.error ?? notificationStore.error ?? settingsStore.error
  const [stockWarning, setStockWarning] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [expiryFilter, setExpiryFilter] = useState('All expiry statuses')
  const [stockFilter, setStockFilter] = useState('All stock levels')
  const [sortBy, setSortBy] = useState('name')
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Medicine | null>(null)
  const [details, setDetails] = useState<Medicine | null>(null)
  const [deleting, setDeleting] = useState<Medicine | null>(null)
  const [menu, setMenu] = useState<number | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>('default')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const notifiedExpiryKeys = useRef(new Set(storedNotifications.filter(item => item.type === 'expiry').map(item => item.id)))
  const notifiedDoseKeys = useRef(new Set(storedNotifications.filter(item => item.type === 'dose').map(item => item.id)))
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    setNotificationPermission(readBrowserNotificationPermission(typeof Notification === 'undefined' ? null : Notification))
  }, [])
  useEffect(() => {
    if (!settings.expiryNotifications) return
    const detected = collectNewExpiryNotifications(medicines, currentDate, notifiedExpiryKeys.current)
    if (detected.length) setNotifications(current => [...detected.filter(item => !current.some(previous => previous.id === item.id)).map(item => ({ id: item.id, type: 'expiry' as const, medicineId: item.medicineId, medicineName: item.medicineName, status: item.status, daysRemaining: item.daysRemaining, message: item.status === 'EXPIRED' ? `Expired ${Math.abs(item.daysRemaining ?? 0)} days ago` : `Expires in ${item.daysRemaining} days`, timestamp: currentDate.toISOString(), readAt: null })), ...current].slice(0, 100))
  }, [medicines, currentDate, settings.expiryNotifications, setNotifications])
  useEffect(() => {
    setDoseRecords(current => materializeMissedDoseRecords(reminders, medicines, current, currentDate, settings.missedDoseGraceMinutes))
  }, [reminders, medicines, currentDate, settings.missedDoseGraceMinutes, setDoseRecords])
  const todayKey = dateKey(currentDate)
  const todayDoses = useMemo(() => enumerateScheduledOccurrences(reminders, medicines, todayKey, todayKey, doseRecords, currentDate, settings.missedDoseGraceMinutes), [reminders, medicines, todayKey, doseRecords, currentDate, settings.missedDoseGraceMinutes])
  const notificationDoses = useMemo(() => enumerateScheduledOccurrences(reminders, medicines, todayKey, shiftDateKey(todayKey, 1), doseRecords, currentDate, settings.missedDoseGraceMinutes), [reminders, medicines, todayKey, doseRecords, currentDate, settings.missedDoseGraceMinutes])
  const weekStartKey = shiftDateKey(todayKey, -6)
  const weeklyDoses = useMemo(() => enumerateScheduledOccurrences(reminders, medicines, weekStartKey, todayKey, doseRecords, currentDate, settings.missedDoseGraceMinutes), [reminders, medicines, weekStartKey, todayKey, doseRecords, currentDate, settings.missedDoseGraceMinutes])
  const weeklyDoseChart = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = shiftDateKey(weekStartKey, index)
    const dayDoses = weeklyDoses.filter(dose => dose.scheduledDateTime.startsWith(day))
    const date = new Date(`${day}T12:00:00`)
    return { day: date.toLocaleDateString('en-US', { weekday: 'short' }), taken: dayDoses.filter(dose => dose.status === 'TAKEN').length, missed: dayDoses.filter(dose => dose.status === 'MISSED').length }
  }), [weekStartKey, weeklyDoses])
  useEffect(() => {
    if (!settings.doseNotifications) return
    const detected = collectNewDoseNotifications(notificationDoses, currentDate, notifiedDoseKeys.current)
    if (!detected.length) return
    const stored: AppNotification[] = detected.map(item => ({ id: item.id, type: 'dose', medicineId: item.medicineId, medicineName: item.medicineName, dosage: item.dosage, scheduledDateTime: item.scheduledDateTime, kind: item.kind, message: item.kind === 'MISSED' ? `Dose marked missed · ${item.dosage}` : item.kind === 'DUE' ? `Dose due now · ${item.dosage}` : `Dose coming up · ${item.dosage}`, timestamp: currentDate.toISOString(), readAt: null }))
    setNotifications(current => [...stored.filter(item => !current.some(previous => previous.id === item.id)), ...current].slice(0, 100))
    if (settings.browserNotificationsEnabled && notificationPermission === 'granted' && typeof Notification !== 'undefined') {
      detected.forEach(item => {
        const scheduled = new Date(`${item.scheduledDateTime}:00`)
        const time = Number.isNaN(scheduled.getTime()) ? item.scheduledDateTime.slice(11) : scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        const title = item.kind === 'MISSED' ? 'Dose marked as missed' : item.kind === 'DUE' ? 'Medicine dose due' : 'Medicine dose coming up'
        try { new Notification(title, { body: `${item.medicineName} · ${item.dosage} · ${time}` }) } catch { setNotificationPermission('unsupported') }
      })
    }
  }, [notificationDoses, currentDate, notificationPermission, settings.doseNotifications, settings.browserNotificationsEnabled, setNotifications])
  const today = new Date()
  const todayLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dayNumber = today.toLocaleDateString('en-US', { day: '2-digit' })
  const monthShort = today.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const filtered = useMemo(() => filterAndSortMedicines(medicines, { query: search, category: categoryFilter, expiry: expiryFilter, stock: stockFilter, sort: sortBy as 'name' | 'expiry' }), [medicines, search, categoryFilter, expiryFilter, stockFilter, sortBy])
  const stockSummary = summarizeStock(medicines)
  const upcomingDoseCount = todayDoses.filter(dose => dose.status === 'UPCOMING').length
  const dueDoseCount = todayDoses.filter(dose => dose.status === 'DUE').length
  const takenDoseCount = todayDoses.filter(dose => dose.status === 'TAKEN').length
  const missedDoseCount = todayDoses.filter(dose => dose.status === 'MISSED').length
  const weekTakenCount = weeklyDoses.filter(dose => dose.status === 'TAKEN').length
  const weekMissedCount = weeklyDoses.filter(dose => dose.status === 'MISSED').length
  const weekResolvedCount = weeklyDoses.filter(dose => dose.status === 'TAKEN' || dose.status === 'MISSED' || dose.status === 'SKIPPED').length
  const weekAdherence = weekResolvedCount ? Math.round((weekTakenCount / weekResolvedCount) * 100) : 0
  const actionableDoses = todayDoses.filter(dose => dose.status === 'DUE' || dose.status === 'UPCOMING').slice(0, 3)
  const completeDoseAction = (occurrence: DoseOccurrence, status: RecordedDoseStatus) => {
    const result = applyDoseStockTransaction(medicines, doseRecords, stockMovements, occurrence, status, currentDate.toISOString())
    if (result.error) { setStockWarning(result.error); return }
    if (!persistBatch({ [STORAGE_KEYS.medicines]: result.medicines, [STORAGE_KEYS.doseRecords]: result.records, [STORAGE_KEYS.stockMovements]: result.movements })) { setStockWarning('This dose and its stock movement could not be saved together. Free browser storage and try again.'); return }
    setMedicines(result.medicines); setDoseRecords(result.records); setStockMovements(result.movements)
    if (status === 'TAKEN' && settings.stockNotifications) { const updated = result.medicines.find(item => item.id === occurrence.medicine.id); if (updated && getStockStatus(updated.quantity, updated.lowStockThreshold) !== getStockStatus(occurrence.medicine.quantity, occurrence.medicine.lowStockThreshold)) setNotifications(current => [{ id: `dose-stock-${occurrence.key}-${result.movements[0]?.id ?? currentDate.getTime()}`, type: 'stock' as const, medicineId: updated.id, medicineName: updated.name, status: getStockStatus(updated.quantity, updated.lowStockThreshold), message: `Stock changed to ${updated.quantity} ${updated.unit} after a dose was recorded.`, timestamp: currentDate.toISOString(), readAt: null }, ...current].slice(0, 100)) }
  }
  const adjustInventory = (adjustment: StockAdjustment) => {
    const result = adjustStock(medicines, stockMovements, adjustment, currentDate)
    if (result.error) return result.error
    if (!persistBatch({ [STORAGE_KEYS.medicines]: result.medicines, [STORAGE_KEYS.stockMovements]: result.movements })) return 'This stock adjustment could not be saved. Free browser storage and try again.'
    setMedicines(result.medicines); setStockMovements(result.movements)
    const updated = result.medicines.find(item => item.id === adjustment.medicineId)
    if (updated && settings.stockNotifications) setNotifications(current => [{ id: result.movements[0].id, type: 'stock' as const, medicineId: updated.id, medicineName: updated.name, status: getStockStatus(updated.quantity, updated.lowStockThreshold), message: `Stock adjusted · now ${updated.quantity} ${updated.unit}. ${adjustment.reason.trim()}`, timestamp: currentDate.toISOString(), readAt: null }, ...current].slice(0, 100))
    return null
  }
  const correctDose = (id: string, status: RecordedDoseStatus) => {
    const result = correctDoseStockTransaction(medicines, doseRecords, stockMovements, id, status, currentDate.toISOString())
    if (result.error) { setStockWarning(result.error); return }
    if (!persistBatch({ [STORAGE_KEYS.medicines]: result.medicines, [STORAGE_KEYS.doseRecords]: result.records, [STORAGE_KEYS.stockMovements]: result.movements })) { setStockWarning('This correction and its stock reversal could not be saved together. Free browser storage and try again.'); return }
    setMedicines(result.medicines); setDoseRecords(result.records); setStockMovements(result.movements)
  }
  const saveReminder = (draft: MedicineReminderDraft, id?: number) => setReminders(current => upsertReminder(current, draft, id))
  const enableBrowserNotifications = async () => {
    const permission = await requestBrowserNotificationPermission(typeof Notification === 'undefined' ? null : Notification)
    setNotificationPermission(permission)
    setSettings(current => ({ ...current, browserNotificationsEnabled: permission === 'granted' }))
    return permission
  }
  const expiryAlerts = medicines.filter(m => {
    const status = calculateExpiry(m.expiryDate, currentDate).status
    return status === 'EXPIRED' || status === 'EXPIRING_SOON'
  }).sort((a, b) => {
    const aResult = calculateExpiry(a.expiryDate, currentDate)
    const bResult = calculateExpiry(b.expiryDate, currentDate)
    return (aResult.daysRemaining ?? Infinity) - (bResult.daysRemaining ?? Infinity)
  }).slice(0, 3)
  const openEdit = (medicine: Medicine) => { setEditing(medicine); setDetails(null); setFormOpen(true); setMenu(null) }
  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const saveMedicine = (draft: MedicineDraft) => {
    const current = medicines.find(item => item.id === editing?.id)
    let nextMedicines = medicines
    let nextMovements = stockMovements
    if (current && current.quantity !== Number(draft.quantity)) {
      const result = adjustStock(nextMedicines, nextMovements, { medicineId: current.id, type: 'correct', quantity: Number(draft.quantity), reason: 'Quantity corrected while editing medicine details', date: dateKey(currentDate) }, currentDate)
      if (result.error) { setStockWarning(result.error); return }
      nextMedicines = result.medicines; nextMovements = result.movements
    }
    if (current && current.lowStockThreshold !== (draft.lowStockThreshold ?? 7)) {
      const result = adjustStock(nextMedicines, nextMovements, { medicineId: current.id, type: 'threshold', quantity: 0, threshold: draft.lowStockThreshold ?? 7, reason: 'Low-stock threshold updated in medicine details', date: dateKey(currentDate) }, currentDate)
      if (result.error) { setStockWarning(result.error); return }
      nextMedicines = result.medicines; nextMovements = result.movements
    }
    nextMedicines = upsertMedicine(nextMedicines, draft, editing?.id)
    if (!persistBatch({ [STORAGE_KEYS.medicines]: nextMedicines, [STORAGE_KEYS.stockMovements]: nextMovements })) { setStockWarning('Medicine changes could not be saved. Free browser storage and try again.'); return }
    setMedicines(nextMedicines); setStockMovements(nextMovements)
    if (current && nextMovements !== stockMovements && settings.stockNotifications) setNotifications(alerts => [{ id: nextMovements[0].id, type: 'stock' as const, medicineId: current.id, medicineName: current.name, status: getStockStatus(nextMedicines.find(item=>item.id===current.id)?.quantity ?? 0, nextMedicines.find(item=>item.id===current.id)?.lowStockThreshold), message: 'Inventory was manually updated from medicine details.', timestamp: currentDate.toISOString(), readAt: null }, ...alerts].slice(0, 100))
    setFormOpen(false); setEditing(null)
  }
  const confirmDelete = () => {
    if (!deleting) return
    const nextMedicines = removeMedicine(medicines, deleting.id)
    const nextReminders = reminders.filter(reminder => reminder.medicineId !== deleting.id)
    if (!persistBatch({ [STORAGE_KEYS.medicines]: nextMedicines, [STORAGE_KEYS.reminders]: nextReminders })) { setStockWarning('The medicine and its reminders could not be removed from saved data. Free browser storage and try again.'); return }
    setMedicines(nextMedicines); setReminders(nextReminders)
    setDeleting(null); setDetails(null); setMenu(null)
  }

  const clearAllData = () => { const cleared: ApplicationData = { medicines: [], reminders: [], doseRecords: [], stockMovements: [], notifications: [], settings: defaultAppSettings }; if (!persistBatch({ [STORAGE_KEYS.medicines]: cleared.medicines, [STORAGE_KEYS.reminders]: cleared.reminders, [STORAGE_KEYS.doseRecords]: cleared.doseRecords, [STORAGE_KEYS.stockMovements]: cleared.stockMovements, [STORAGE_KEYS.notifications]: cleared.notifications, [STORAGE_KEYS.settings]: cleared.settings })) return 'Could not clear data in browser storage.'; setMedicines(cleared.medicines); setReminders(cleared.reminders); setDoseRecords(cleared.doseRecords); setStockMovements(cleared.stockMovements); setNotifications(cleared.notifications); setSettings(cleared.settings); notifiedExpiryKeys.current.clear(); notifiedDoseKeys.current.clear(); setDetails(null); return null }
  const resetDemoData = () => { const data = buildDemoData(); if (!persistBatch({ [STORAGE_KEYS.medicines]: data.medicines, [STORAGE_KEYS.reminders]: data.reminders, [STORAGE_KEYS.doseRecords]: data.doseRecords, [STORAGE_KEYS.stockMovements]: data.stockMovements, [STORAGE_KEYS.notifications]: data.notifications, [STORAGE_KEYS.settings]: data.settings })) return 'Could not restore demo data in browser storage.'; setMedicines(data.medicines); setReminders(data.reminders); setDoseRecords(data.doseRecords); setStockMovements(data.stockMovements); setNotifications(data.notifications); setSettings(data.settings); notifiedExpiryKeys.current.clear(); notifiedDoseKeys.current.clear(); setDetails(null); return null }
  const importData = (data: ApplicationData) => { if (!persistBatch({ [STORAGE_KEYS.medicines]: data.medicines, [STORAGE_KEYS.reminders]: data.reminders, [STORAGE_KEYS.doseRecords]: data.doseRecords, [STORAGE_KEYS.stockMovements]: data.stockMovements, [STORAGE_KEYS.notifications]: data.notifications, [STORAGE_KEYS.settings]: data.settings })) return 'Could not save the imported backup. Current data was kept.'; setMedicines(data.medicines); setReminders(data.reminders); setDoseRecords(data.doseRecords); setStockMovements(data.stockMovements); setNotifications(data.notifications); setSettings(data.settings); notifiedExpiryKeys.current.clear(); data.notifications.filter(item => item.type === 'expiry').forEach(item => notifiedExpiryKeys.current.add(item.id)); notifiedDoseKeys.current.clear(); data.notifications.filter(item => item.type === 'dose').forEach(item => notifiedDoseKeys.current.add(item.id)); setDetails(null); return null }
  const markNotificationRead = (id: string) => setNotifications(current => current.map(item => item.id === id ? { ...item, readAt: item.readAt ?? currentDate.toISOString() } : item))
  const appData: ApplicationData = { medicines, reminders, doseRecords, stockMovements, notifications: storedNotifications, settings }
  const unreadNotificationCount = storedNotifications.filter(item => !item.readAt).length

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#overview" onClick={() => setActiveNav('Dashboard')}><span className="brand-mark"><HeartPulse size={20} strokeWidth={2.4} /></span><span>Medi<span className="brand-light">Track</span><small>CARE, IN GOOD MEASURE</small></span></a>
      <div className="workspace-switch"><div className="workspace-avatar">S</div><div className="workspace-copy"><b>Sarah’s workspace</b><small>Personal account</small></div><ChevronDown size={15} /></div>
      <div className="nav-caption">MENU</div>
      <nav className="main-nav">{navigationItems.map(({ label, icon: Icon, dot }) => <button key={label} className={`nav-link ${activeNav === label ? 'selected' : ''}`} onClick={() => { setActiveNav(label); setMobileNav(false) }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'My medicines' && <span className="nav-count">{medicines.length}</span>}{dot && <span className="nav-dot" />}</button>)}</nav>
      <div className="nav-caption tools-caption">PREFERENCES</div>
      <nav className="main-nav"><button className={`nav-link ${activeNav === 'Settings' ? 'selected' : ''}`} onClick={() => setActiveNav('Settings')}><Settings size={18} /><span>Settings</span></button><button className="nav-link" onClick={() => { setActiveNav('Settings'); setMobileNav(false) }}><CircleHelp size={18} /><span>Help &amp; support</span></button></nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><span className="upgrade-icon"><Sparkles size={16} /></span><b>Your health, in focus.</b><p>A little consistency goes a long way. You’re doing great!</p><div className="upgrade-progress"><span /></div><small>YOUR WEEKLY STREAK <b>5 days</b></small></div><div className="profile-mini"><div className="profile-avatar">SC</div><div><b>Sarah Chen</b><small>Personal plan</small></div><MoreHorizontal size={19} /></div></div>
    </aside>

    <main className="main-content" id="overview">
      <header className="topbar"><div className="topbar-title"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation"><Menu size={21} /></button><div><span className="eyebrow">{todayLabel}</span><h1>Good morning, Sarah <span className="wave">✳</span></h1></div></div><div className="topbar-actions"><label className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search medicines..." /><kbd>⌘ K</kbd></label><div className="notification-wrap"><button className="icon-button notification" aria-label={`Notifications, ${storedNotifications.length} alerts, ${unreadNotificationCount} unread`} onClick={() => setNotificationsOpen(open => !open)}><Bell size={19} />{unreadNotificationCount > 0 && <i />}</button>{notificationsOpen && <div className="notification-panel"><div className="notification-heading"><div><b>Notifications</b><small>{unreadNotificationCount} unread · {storedNotifications.length} total</small></div><button onClick={() => setNotifications(current => current.map(item => ({...item, readAt: item.readAt ?? currentDate.toISOString()})))}>Mark all read</button><button onClick={() => setNotifications([])}>Clear all</button></div>{storedNotifications.length === 0 ? <p className="notification-empty">You’re all caught up.</p> : <div className="notification-list">{storedNotifications.map(notification => <button key={notification.id} className={`notification-item ${notification.readAt ? 'notification-read' : ''}`} onClick={() => { markNotificationRead(notification.id); if(notification.type==='dose')setActiveNav('Reminders');else if(notification.type==='stock')setActiveNav('Inventory');else {const medicine=medicines.find(item=>item.id===notification.medicineId);if(medicine)setDetails(medicine)} setNotificationsOpen(false) }}><span className={`notification-symbol ${notification.type==='stock'&&notification.status==='OUT OF STOCK'||notification.type==='expiry'&&notification.status==='EXPIRED'||notification.type==='dose'&&notification.kind==='MISSED'?'expired':notification.type==='stock'&&notification.status==='LOW STOCK'||notification.type==='expiry'&&notification.status==='EXPIRING_SOON'||notification.type==='dose'&&notification.kind==='DUE'?'urgent':'upcoming'}`}>{notification.type==='stock'?<Package size={15}/>:notification.type==='dose'?<BellRing size={15}/>:<AlertCircle size={15}/>}</span><span><b>{notification.medicineName}</b><small>{notification.message}</small></span><ChevronRight size={15}/></button>)}</div>}</div>}</div><div className="top-profile" aria-label="Sample profile"><span className="profile-avatar">SC</span><ChevronDown size={15} /></div><button className="add-button" onClick={openAdd}><Plus size={17} /> Add medicine</button></div></header>
      {storageError && activeNav !== 'Settings' && <div className="storage-warning-banner" role="status"><AlertCircle size={15}/>{storageError}<button onClick={()=>setActiveNav('Settings')}>Open settings</button></div>}
      {activeNav === 'Expiry tracker' ? <Suspense fallback={<PageLoading/>}><ExpiryTracker medicines={medicines} onSelect={setDetails} /></Suspense> : activeNav === 'Reminders' ? <Suspense fallback={<PageLoading/>}><Reminders medicines={medicines} reminders={reminders} records={doseRecords} now={currentDate} graceMinutes={settings.missedDoseGraceMinutes} notificationPermission={notificationPermission} onEnableNotifications={enableBrowserNotifications} onSaveReminder={saveReminder} onToggleReminder={(id, active) => setReminders(current => setReminderActive(current, id, active, currentDate))} onDeleteReminder={id => setReminders(current => removeReminder(current, id))} onDoseAction={completeDoseAction} onCorrectDose={correctDose} /></Suspense> : activeNav === 'Inventory' || activeNav === 'Analytics' ? <Suspense fallback={<PageLoading/>}><Inventory medicines={medicines} movements={stockMovements} onAdjust={adjustInventory} /></Suspense> : activeNav === 'Settings' ? <Suspense fallback={<PageLoading/>}><SettingsPage data={appData} settings={settings} permission={notificationPermission} storageError={storageError} onSettings={setSettings} onRequestNotifications={enableBrowserNotifications} onImport={importData} onClear={clearAllData} onResetDemo={resetDemoData} /></Suspense> : <div className="dashboard-body">
        <section className="welcome-banner"><div className="welcome-copy"><span className="banner-kicker"><Sparkles size={14} /> YOUR HEALTH, AT A GLANCE</span><h2>Small steps. <em>Big difference.</em></h2><p>Never miss a dose. Never waste a medicine.</p><div className="banner-meta"><span><span className="live-dot" /> Your routine is looking good</span><span className="meta-sep">·</span><span>{takenDoseCount} of {todayDoses.length} scheduled doses taken · {missedDoseCount} missed</span></div></div><div className="streak-card"><div className="streak-top"><span>WEEKLY ADHERENCE</span><span className="trend-up">{weekResolvedCount} doses tracked</span></div><div className="streak-value">{weekAdherence}<span>%</span></div><div className="streak-note">Based on the last 7 days of dose records</div><div className="streak-bars">{weeklyDoseChart.map((day, i) => { const resolved = day.taken + day.missed; const height = resolved ? Math.max(18, Math.round(day.taken / resolved * 100)) : 12; return <div key={day.day} className="streak-bar-wrap"><span style={{ height: `${height}%` }} className={i === 6 ? 'bar-today' : ''} /><small>{day.day.slice(0, 1)}</small></div> })}</div></div><div className="banner-decoration decor-one" /><div className="banner-decoration decor-two" /></section>

        <section className="stats-grid" aria-label="Medicine and stock summary"><StatCard icon={<Pill size={18} />} label="Total medicines" value={String(stockSummary.totalMedicines)} note="In your cabinet" color="mint" /><StatCard icon={<Boxes size={18} />} label="Available units" value={String(stockSummary.totalUnits)} note="Across all medicines" color="blue" /><StatCard icon={<Package size={18} />} label="Low stock" value={String(stockSummary.lowStock)} note="At or below threshold" color="peach" /><StatCard icon={<Package size={18} />} label="Out of stock" value={String(stockSummary.outOfStock)} note="Refill needed" color="yellow" /><StatCard icon={<CircleDollarSign size={18} />} label="Stock value" value={stockSummary.totalValue === null ? '—' : `$${stockSummary.totalValue.toFixed(2)}`} note={stockSummary.totalValue === null ? 'Add purchase prices' : 'Based on recorded prices'} color="lilac" /></section>

        <section className="inventory-toolbar" aria-label="Filter medicines"><label className="filter-select"><span>Category</span><select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option>All categories</option>{['Antibiotic', 'Pain Relief', 'Vitamin', 'Supplement', 'Allergy', 'Other'].map(category => <option key={category}>{category}</option>)}</select></label><label className="filter-select"><span>Expiry</span><select value={expiryFilter} onChange={e => setExpiryFilter(e.target.value)}><option>All expiry statuses</option><option>Expiring soon</option><option>Expired</option><option>Not expiring</option></select></label><label className="filter-select"><span>Stock</span><select value={stockFilter} onChange={e => setStockFilter(e.target.value)}><option>All stock levels</option><option>Low stock</option><option>In stock</option></select></label><label className="filter-select sort-filter"><span>Sort by</span><select value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="name">Medicine name (A–Z)</option><option value="expiry">Expiry date (soonest)</option></select></label><button className="clear-filters" onClick={() => { setCategoryFilter('All categories'); setExpiryFilter('All expiry statuses'); setStockFilter('All stock levels'); setSortBy('name'); setSearch('') }}>Clear filters</button></section>

        <div className="content-grid"><section className="panel inventory-panel"><div className="panel-header"><div><div className="section-label">YOUR CABINET</div><h3>Medicine inventory <span className="count-pill">{filtered.length}</span></h3><p className="panel-subtitle">A little overview of what you have on hand.</p></div><button className="text-button" onClick={openAdd}><Plus size={14} /> Add medicine</button></div><div className="table-scroll"><table><thead><tr><th>MEDICINE</th><th>CATEGORY</th><th>QUANTITY</th><th>EXPIRY DATE</th><th>DOSAGE</th><th>STATUS</th><th /></tr></thead><tbody>{filtered.map(m => { const status = getMedicineStatus(m); return <tr key={m.id} className="medicine-row"><td><button className="medicine-cell medicine-name-button" onClick={() => setDetails(m)}><span className={`med-icon ${m.color}`}>{m.initials}</span><span><b>{m.name}</b><small>{m.type} · {m.frequency}</small></span></button></td><td><span className="category-text">{m.category}</span></td><td><span className={`quantity ${status === 'Low stock' ? 'quantity-low' : ''}`}>{String(m.quantity).padStart(2, '0')} <small>{m.unit}</small></span></td><td><span className="expiry-text">{formatDate(m.expiryDate)}</span></td><td><span className="dosage-cell">{m.dosage}</span></td><td><Status status={status} /></td><td className="action-cell"><button className="more-button" aria-label={`Actions for ${m.name}`} onClick={() => setMenu(menu === m.id ? null : m.id)}><Ellipsis size={18} /></button>{menu === m.id && <div className="action-menu"><button onClick={() => { setDetails(m); setMenu(null) }}><Pill size={14} /> View details</button><button onClick={() => openEdit(m)}><Pencil size={14} /> Edit medicine</button><button className="delete-action" onClick={() => { setDeleting(m); setMenu(null) }}><Trash2 size={14} /> Remove</button></div>}</td></tr> })}</tbody></table>{filtered.length === 0 && <div className="empty-state">No medicines match your search or filters.</div>}</div><div className="table-footer"><span>Showing <b>{filtered.length}</b> of <b>{medicines.length}</b> medicines</span><span className="inventory-hint">Select a medicine name to view details</span></div></section>

        <section className="panel reminders-panel"><div className="panel-header"><div><div className="section-label">STAY ON TRACK</div><h3>Today’s reminders <span className="reminder-count">{dueDoseCount} due · {upcomingDoseCount} upcoming</span></h3><p className="panel-subtitle">{missedDoseCount} missed dose{missedDoseCount === 1 ? '' : 's'} today · {takenDoseCount} completed</p></div><button className="more-button" aria-label="Open reminder management" onClick={() => setActiveNav('Reminders')}><BellRing size={17} /></button></div><div className="reminder-date"><div className="date-tile"><b>{dayNumber}</b><small>{monthShort}</small></div><div><b>{weekday}</b><small>Your daily routine</small></div><span className="today-tag">TODAY</span></div><div className="reminder-list">{actionableDoses.length ? actionableDoses.map(occurrence => <div className="reminder-row live-reminder-row" key={occurrence.key}><div className="reminder-time">{formatScheduleTime(occurrence.scheduledDateTime)}</div><span className={`reminder-icon ${occurrence.medicine.color}`}><Pill size={16} /></span><div className="reminder-detail"><b>{occurrence.medicine.name}</b><small>{occurrence.reminder.dosage} · {occurrence.reminder.frequency}</small></div><span className={`live-dose-status ${occurrence.status === 'DUE' ? 'live-dose-due' : 'live-dose-upcoming'}`}>{occurrence.status === 'DUE' ? 'Due now' : 'Upcoming'}</span>{occurrence.status === 'DUE' && <button className="dose-check" aria-label={`Mark ${occurrence.medicine.name} as taken`} onClick={() => completeDoseAction(occurrence, 'TAKEN')}><Check size={12} /></button>}</div>) : <div className="reminder-inline-empty">{todayDoses.length === 0 ? 'No doses are scheduled today.' : 'All of today’s doses have been recorded.'}</div>}</div><button className="reminder-cta" onClick={() => setActiveNav('Reminders')}>Manage reminders & dose history <ArrowUpRight size={14} /></button></section></div>

        <Suspense fallback={<div className="lower-grid"><PageLoading/></div>}><DashboardAnalytics data={weeklyDoseChart} taken={weekTakenCount} missed={weekMissedCount} adherence={weekAdherence}/></Suspense>

        <div className="bottom-grid"><section className="panel expiry-panel"><div className="panel-header"><div><div className="section-label">A FRIENDLY HEADS-UP</div><h3>Expiry watch <span className="alert-count">{medicines.filter(m => ['EXPIRED', 'EXPIRING_SOON'].includes(calculateExpiry(m.expiryDate, currentDate).status)).length}</span></h3></div><button className="text-button" onClick={() => setActiveNav('Expiry tracker')}>See all <ChevronRight size={15} /></button></div>{expiryAlerts.length ? expiryAlerts.map(medicine => { const result = calculateExpiry(medicine.expiryDate, currentDate); return <button className="expiry-item expiry-alert-button" key={medicine.id} onClick={() => setDetails(medicine)}><span className={`expiry-symbol ${result.status === 'EXPIRED' ? 'alert-expired' : 'alert-soon'}`}><CalendarDays size={17} /></span><span className="expiry-info"><b>{medicine.name}</b><small>{medicine.dosage} · {medicine.quantity} {medicine.unit} left</small></span><span className="expiry-date"><b>{formatDate(medicine.expiryDate)}</b><span>{result.status === 'EXPIRED' ? `Expired ${Math.abs(result.daysRemaining ?? 0)} days ago` : result.daysRemaining === 0 ? 'Expires today' : result.daysRemaining === 1 ? 'Expires tomorrow' : `${result.daysRemaining} days remaining`}</span></span><ChevronRight size={16} className="subtle-chevron" /></button> }) : <div className="empty-state expiry-empty">Nothing is expired or expiring within 7 days.</div>}<div className="expiry-note"><ShieldCheck size={15} /> Expiry status uses the date entered for each medicine.</div></section>
          <section className="panel activity-panel"><div className="panel-header"><div><div className="section-label">INVENTORY AUDIT</div><h3>Recent stock movements</h3></div><button className="text-button" onClick={() => setActiveNav('Inventory')}>View history <ChevronRight size={14}/></button></div><div className="activity-list">{stockMovements.slice(0,3).map(move=><div className="activity-item" key={move.id}><span className={`activity-icon ${move.movementType==='Medicine Consumed'?'activity-green':move.movementType==='Stock Removed'?'activity-amber':'activity-blue'}`}><Package size={14}/></span><span className="activity-copy"><b>{move.movementType}</b><small>{move.medicineName} · {move.previousQuantity} → {move.newQuantity}</small></span><time>{new Date(move.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></div>)}{stockMovements.length===0&&<div className="stock-dashboard-empty">Stock movements will appear here after inventory changes.</div>}</div></section></div>
        <footer className="page-footer"><span><HeartPulse size={14} /> Take care of yourself, one dose at a time.</span><span>Made for your wellbeing <span className="footer-heart">♥</span></span></footer>
      </div>}
    </main>
    {mobileNav && <button className="sidebar-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    {formOpen && <MedicineFormModal medicine={editing} defaultThreshold={settings.defaultLowStockThreshold} onClose={() => { setFormOpen(false); setEditing(null) }} onSave={saveMedicine} />}
    {details && <MedicineDetailsModal medicine={details} onClose={() => setDetails(null)} onEdit={() => openEdit(details)} />}
    {deleting && <DeleteMedicineDialog medicine={deleting} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />}
    {stockWarning && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setStockWarning('')}}><section className="medicine-modal stock-warning-dialog" role="alertdialog" aria-modal="true"><span className="stock-warning-icon"><AlertCircle size={20}/></span><h2>Inventory needs attention</h2><p>{stockWarning}</p><div className="modal-actions"><button className="cancel-button" onClick={()=>setStockWarning('')}>Close</button><button className="add-button" onClick={()=>{setStockWarning('');setActiveNav('Inventory')}}>Open inventory <ArrowUpRight size={14}/></button></div></section></div>}
  </div>
}

function StatCard({ icon, label, value, note, color }: { icon: React.ReactNode; label: string; value: string; note: string; color: string }) { return <article className="stat-card"><span className={`stat-icon ${color}`}>{icon}</span><div className="stat-text"><span>{label}</span><b>{value}</b><small>{note}</small></div><span className="stat-decoration"><ArrowUpRight size={15} /></span></article> }
function PageLoading() { return <div className="page-loading" role="status">Loading MediTrack view…</div> }
function Status({ status }: { status: ReturnType<typeof getMedicineStatus> }) { const cls = status === 'Active' ? 'status-active' : status === 'Low stock' ? 'status-low' : status === 'Expired' ? 'status-expired' : status === 'Expiring' ? 'status-window' : status === 'Invalid date' ? 'status-invalid' : 'status-expiring'; return <span className={`status-pill ${cls}`}><i />{status}</span> }
function formatScheduleTime(value: string) { const [, time = ''] = value.split('T'); const [hourText, minute] = time.split(':'); const hour = Number(hourText); return Number.isFinite(hour) ? `${hour % 12 || 12}:${minute ?? '00'} ${hour >= 12 ? 'PM' : 'AM'}` : value }

export default App
