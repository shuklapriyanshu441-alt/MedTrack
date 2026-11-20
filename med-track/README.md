# MediTrack

MediTrack is a frontend-only medicine management dashboard for tracking medicine details, expiry dates, reminders, dose history, and household stock.

> Never Miss a Dose. Never Waste a Medicine.

## Features

- Medicine CRUD with validation, search, category and expiry filters, and sorting.
- Calendar-date expiry tracking, alerts, and a dedicated expiry view.
- Daily reminders, taken/skipped/missed dose records, corrections, and dose history.
- Stock thresholds, manual adjustments, dose consumption, reversals, history, and analytics.
- Dashboard summaries and in-app notifications with persistent read state.
- Settings for notification preferences, missed-dose grace period, and default stock threshold.
- JSON backup export/import, demo data reset, and confirmed clear-data action.
- Responsive desktop, tablet, and mobile layouts.

## Technology

- React 19, TypeScript, Vite
- Recharts for data visualizations
- Lucide React for icons
- Browser LocalStorage for persistence
- Node.js built-in test runner

## Windows CMD: install and run

Open Command Prompt, then run:

```cmd
cd /d "C:\Users\LENOVO\OneDrive\Desktop\MedTrack\med-track"
if not exist node_modules npm install
npm run dev
```

Vite prints a local URL in the terminal. To create and preview a production build:

```sh
npm run build
npm run preview
```

## LocalStorage architecture

`src/hooks/usePersistentState.ts` loads normalized values and writes changes only when the serialized value changes. `src/services/storageService.ts` handles storage errors and journaled multi-key transactions for dose/stock updates. `src/utils/dataMigration.ts` normalizes stored records and validates imports.

The app uses these keys:

| Key | Contents |
| --- | --- |
| `meditrack_medicines` | Medicine details, quantity, thresholds, and optional purchase prices |
| `meditrack_reminders` | Reminder schedules and pause state |
| `meditrack_dose_records` | Taken, skipped, missed, and corrected dose history |
| `meditrack_stock_movements` | Stock additions, removals, corrections, consumption, and reversals |
| `meditrack_notifications` | In-app alerts and read/unread timestamps |
| `meditrack_settings` | Notification preferences and tracking defaults |

A temporary `meditrack_pending_transaction` journal is used to recover an interrupted multi-key stock/dose write. It is removed after recovery.

All application data remains in the current browser profile. Export a JSON backup before clearing browser data or moving to another device.

## Project structure

```text
src/
  components/  Shared forms, dialogs, dashboard charts, dose UI
  data/        Medicine models, demo records, medicine CRUD helpers
  hooks/       Persistent React state
  pages/       Expiry tracker, reminders, inventory, settings
  services/    LocalStorage access and transaction journal
  types/       Shared application data interfaces
  utils/       Expiry, reminder, stock, notification, migration logic
tests/         Node unit tests for medicine, expiry, reminder, stock, storage, and import/export logic
```

## Tests

```sh
npm test
```

## Known limitations

- LocalStorage is browser-local and has finite capacity. Data is not synchronized between devices and can be removed by clearing site data.
- Browser notifications require explicit user permission and only run while MediTrack is open; this app does not provide background notifications.
- Reminder scheduling is evaluated while the application is open. It does not use a server or operating-system scheduler.
- Seed medicines do not include purchase prices, so the stock value remains unavailable until prices are entered.
- The monthly adherence panel still uses sample trend values; stock analytics and dose summaries use actual application records.
- No account, backend, external database, or cloud backup is included.
