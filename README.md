# FieldFlow - Offline-First Field Service Tracker

A production-ready Vue 3 + TypeScript field service management application with robust offline-first architecture, Firebase Firestore synchronization, and advanced conflict resolution.

## 🌟 Features

- 📱 **Offline-First Architecture**: Work without internet, sync automatically when reconnected
- 🔁 **Real-time Sync**: Bidirectional synchronization with Firebase Firestore
- 📋 **Job Management**: Create, update, delete service jobs with full CRUD
- 📊 **Status Tracking**: Pending, In Progress, Completed job states with visual indicators
- 🔍 **Search & Filter**: Find jobs by title, customer, or address
- 💾 **Local Storage**: IndexedDB via Dexie for instant offline access
- 🌐 **PWA Support**: Install as a progressive web app for mobile
- ⚡ **Smart Conflict Resolution**: Field-level merging with timestamp tracking
- 🔄 **Sync Queue Inspector**: View and manage pending sync operations
- 📶 **Network Awareness**: Visual online/offline status indicators

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project (for cloud sync)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd fieldflow

# Install dependencies
npm install
```

### Firebase Configuration

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Go to **Project Settings** > **General** > **Your apps** > **Web app**
3. Copy your Firebase configuration
4. Create a `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

5. Fill in your Firebase credentials in `.env.local`:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

6. Configure Firestore security rules (see [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for details)

### Development

```bash
# Start development server
npm run dev

# Run tests
npm run test
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
fieldflow/
├── public/                # Static assets
│   ├── favicon.svg       # App icon
│   └── icons.svg         # Icon set
├── src/
│   ├── components/       # Vue components
│   │   ├── dashboard/   # Dashboard (StatsGrid, StatCard, WelcomePanel)
│   │   ├── jobs/        # Job management (JobList, JobCard, JobForm, JobToolbar)
│   │   ├── layout/      # Layout (AppHeader, AppSidebar, AppFooter, ReloadPrompt)
│   │   └── sync/        # Sync UI (SyncQueueModal, ConflictModal)
│   ├── composables/     # Vue composables
│   │   ├── useJobs.ts          # Job management logic
│   │   ├── useSyncQueue.ts     # Sync queue state management
│   │   └── usePwaInstall.ts    # PWA installation logic
│   ├── db/              # Database layer
│   │   ├── index.ts            # Dexie schema & CRUD operations
│   │   └── syncQueue.ts        # Sync queue operations
│   ├── sync/            # Sync engine
│   │   ├── syncEngine.ts       # Main sync orchestration
│   │   └── conflictResolver.ts # Conflict resolution (LWW & field-level)
│   ├── firebase/        # Firebase configuration
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── .env.local.example   # Firebase credentials template
├── vite.config.ts       # Vite + PWA configuration
└── index.html           # HTML entry point
```

## 🏗️ Architecture

### Phase 1: Local Storage & Job CRUD ✅
- Dexie IndexedDB for local persistence
- Full CRUD operations for jobs
- Seed data for initial setup
- Type-safe TypeScript implementation

### Phase 2: Job Filtering & Search ✅
- Search by title, customer, address
- Filter by status (Pending, In Progress, Completed)
- Stats cards with real-time counts
- Dashboard-only stats display

### Phase 3: Persistent Sync Queue ✅
- Offline operation queuing in Dexie
- Mutation collapsing (merge redundant updates)
- Exponential backoff retry (1s to 30s)
- Manual sync trigger
- Failed item tracking and retry

### Phase 4: Firebase Firestore Sync ✅
- Outbound push engine (local → cloud)
- Inbound pull listener (cloud → local)
- Last-write-wins conflict resolution
- Real-time synchronization via onSnapshot
- Network-aware lifecycle management

### Phase 5: Conflict Resolution ✅
- **Last-Write-Wins (LWW)**: Document-level timestamp comparison
- **Field-Level Merging**: Per-field timestamp tracking
- **Smart Conflict Detection**: Tracks conflicting fields with details
- **Visual Conflict Modal**: UI for manual resolution (ready for integration)
- **Protected Fields**: id, createdAt never overwritten

### Phase 6: PWA Implementation ✅
- Service Worker registration
- Web App Manifest
- Offline caching strategy
- Install prompts
- Responsive design

### Phase 7: Testing & Verification ✅
- Comprehensive test documentation
- Offline simulation tests
- Lighthouse audit ready
- Manual testing guide

## 🔄 Sync Flow

### Offline Operations
```
User Action → Local Dexie (immediate) → Sync Queue (pending) → Mark synced: false
```

### When Online
```
Network Event → Process Queue → Push to Firestore → Mark synced: true → Remove from Queue
```

### Real-time Updates
```
Firestore onSnapshot → Remote Changes → Compare Timestamps → Merge if Newer → UI Refresh
```

### Conflict Resolution
```
Concurrent Edits → Field-Level Merge → Timestamp Comparison → Apply Newer → Track Conflicts
```

## 🧪 Testing

### Manual Testing

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive testing procedures including:
- Cold offline start
- Offline mutations
- Reconnection sync
- Real-time multi-device sync
- Conflict resolution scenarios

### Lighthouse Audit

**Development Mode Scores:**
- PWA: 38 (expected - dev mode limitations)
- Performance: 96 ✅
- Accessibility: 100 ✅
- Best Practices: 91 ✅
- SEO: 91 ✅

**Production Mode (Expected):**
- PWA: 95-100
- Performance: 90+
- Accessibility: 100
- Best Practices: 95+
- SEO: 90+

### Run Tests

```bash
npm run test
```

## 📖 Documentation

- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Complete Firebase configuration guide
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Manual testing procedures
- [PHASE4_IMPLEMENTATION.md](PHASE4_IMPLEMENTATION.md) - Firebase sync details
- [PHASE5_IMPLEMENTATION.md](PHASE5_IMPLEMENTATION.md) - Conflict resolution details
- [PHASE7_TESTING.md](PHASE7_TESTING.md) - Verification checklist
- [PHASE7_SUMMARY.md](PHASE7_SUMMARY.md) - Implementation summary

## 🔧 Configuration

### Firebase Firestore Rules

For development, use permissive rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /jobs/{jobId} {
      allow read, write: if true;
    }
  }
}
```

For production, use authentication-based rules (see FIREBASE_SETUP.md).

### Environment Variables

Required environment variables in `.env.local`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## 🎨 Tech Stack

- **Frontend**: Vue 3 (Composition API), TypeScript
- **Build Tool**: Vite
- **Database**: Dexie (IndexedDB wrapper)
- **Backend**: Firebase Firestore
- **PWA**: vite-plugin-pwa, Workbox
- **Testing**: Vitest
- **Styling**: CSS (custom design system)

## 📊 Data Model

### Job Entity

```typescript
interface Job {
  id: number | string
  title: string
  customer: string
  address: string
  priority: 'Low' | 'Medium' | 'High'
  status: 'Pending' | 'In Progress' | 'Completed'
  scheduledDate: string
  notes?: string
  createdAt?: string
  updatedAt?: string
  synced?: boolean
  isDeleted?: boolean
  dirtyFields?: string[]        // Field-level change tracking
  fieldTimestamps?: Record<string, string>  // Per-field timestamps
}
```

## 🚦 Sync Queue Item

```typescript
interface SyncQueueItem {
  id: number
  entityId: number | string
  jobTitle: string
  action: 'create' | 'update' | 'delete'
  payload: Partial<Job>
  clientTimestamp: number
  retryCount: number
  status: 'pending' | 'processing' | 'failed'
  lastAttemptAt?: number
  nextRetryAt?: number
  errorMessage?: string
}
```

## 🔐 Security

- Firebase Firestore security rules control data access
- Environment variables for sensitive credentials (never committed)
- No server-side secrets in client code
- HTTPS required for production PWA

## 📱 PWA Features

- Installable on desktop and mobile
- Works offline
- Background sync
- App shortcuts
- Theme color customization
- Responsive design (mobile-first)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Vue.js team for the amazing framework
- Firebase team for the backend services
- Dexie for the excellent IndexedDB wrapper
- Vite team for the fast build tool

---

**Built with ❤️ for field service teams everywhere**
