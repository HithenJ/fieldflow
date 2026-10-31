# FieldFlow Architecture Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FieldFlow System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────┐ │
│  │   Browser    │         │   IndexedDB  │         │ Firebase │ │
│  │   (Vue 3)    │◄──────►│   (Dexie)     │◄──────►│ Firestore│ │
│  │              │         │              │         │          │ │
│  │ - Components │         │ - jobs       │         │ - jobs   │ │
│  │ - Composables│         │ - syncQueue  │         │          │ │
│  │ - Sync Engine│         │              │         │          │ │
│  └──────────────┘         └──────────────┘         └──────────┘ │
│         │                        │                        │        │
│         │                        │                        │        │
│         ▼                        ▼                        ▼        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Sync Queue Manager                        │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │  • Queue Operations (create, update, delete)               │ │
│  │  • Mutation Collapsing                                     │ │
│  │  • Exponential Backoff Retry                               │ │
│  │  • Conflict Resolution (LWW + Field-Level)                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Layer (Vue 3)

```
App.vue
├── DashboardView.vue
│   ├── AppHeader.vue
│   ├── AppSidebar.vue
│   ├── WelcomePanel.vue (conditional)
│   ├── StatsGrid.vue (conditional - dashboard only)
│   ├── JobList.vue
│   ├── JobForm.vue (modal)
│   └── SyncQueueModal.vue (modal)
└── AppFooter.vue
```

### Composables Layer

```
useJobs.ts
├── Job CRUD operations
├── Search & filter logic
├── Status management
└── Integration with sync queue

useSyncQueue.ts
├── Sync queue state management
├── Network status tracking
├── Sync orchestration
└── Error handling

usePwaInstall.ts
├── PWA installation prompt
├── Install status tracking
└── Install button handler
```

### Database Layer (Dexie)

```
FieldFlowDatabase (IndexedDB)
├── jobs (Table)
│   ├── Indexed by: id, customer, status, priority, scheduledDate, updatedAt, synced, isDeleted
│   └── Stores: Job entities with full metadata
│
└── syncQueue (Table)
    ├── Indexed by: entityId, action, status, clientTimestamp
    └── Stores: Pending sync operations with retry metadata
```

### Sync Engine Layer

```
SyncEngine
├── Network event listeners (online/offline)
├── Queue processor (push to Firebase)
├── Remote listener (pull from Firebase)
├── Conflict resolver (LWW + field-level)
└── Lifecycle management
```

## Data Flow Diagrams

### 1. Job Creation Flow

```
User clicks "New Job"
        ↓
JobForm.vue opens
        ↓
User fills form & submits
        ↓
handleCreateJob() in DashboardView
        ↓
addJob() in useJobs
        ↓
db.createJob() - Transaction
        ├─ Save to jobs table (synced: false)
        ├─ enqueueCreate() to syncQueue
        └─ processQueueIfOnline()
        ↓
[If Online] → Push to Firestore
[If Offline] → Queue pending
        ↓
UI updates immediately
```

### 2. Offline to Online Sync Flow

```
Device goes offline
        ↓
User creates/updates jobs
        ↓
Operations queued in syncQueue
        ↓
Network event: online
        ↓
SyncEngine.handleNetworkChange()
        ↓
processQueue() triggered
        ↓
For each queue item:
        ├─ Mark as processing
        ├─ pushToFirestore()
        ├─ Conflict resolution
        ├─ Mark job as synced: true
        └─ Remove from queue
        ↓
startRemoteListener()
        ↓
Real-time sync active
```

### 3. Real-time Multi-Device Sync

```
Device A (Online)                Device B (Online)
     │                                  │
     ├─ Creates job                    │
     │                                  │
     ├─ Push to Firestore              │
     │                                  │
     └─ [Firestore]                     │
              │                         │
              │ onSnapshot trigger      │
              │                         │
              └────────────────────────►│
                                        │
                           Device B receives change
                                        │
                           MergeFieldLevel()
                                        │
                           Update IndexedDB
                                        │
                           UI refreshes automatically
```

### 4. Conflict Resolution Flow

```
Local Job                      Remote Job
     │                              │
     ├─ Updated: status           │
     ├─ Timestamp: 10:00          │
     │                              │
     │                              ├─ Updated: address
     │                              ├─ Timestamp: 10:30
     │                              │
Sync starts                      │
     │                              │
     ├─ detectChangedFields()      │
     │                              │
     ├─ mergeFieldLevel()           │
     │  ├─ Compare field timestamps│
     │  ├─ status: local wins (10:00)
     │  ├─ address: remote wins (10:30)
     │  └─ Merge non-conflicting     │
     │                              │
     └─ Result: Merged job         │
              └─ Firebase + IndexedDB
```

## API Documentation

### Database API (Dexie)

#### `db.getActiveJobs()`
**Purpose:** Retrieve all non-deleted jobs

**Returns:** `Promise<Job[]>`

**Example:**
```typescript
const jobs = await db.getActiveJobs()
// Returns array of Job objects where isDeleted !== true
```

#### `db.createJob(payload: NewJobPayload)`
**Purpose:** Create a new job

**Parameters:**
- `payload`: Job data (title, customer, address, priority, scheduledDate, notes)

**Returns:** `Promise<Job>`

**Side Effects:**
- Generates ticket ID (JOB-XXX)
- Sets status to 'Pending'
- Queues create operation in syncQueue
- Marks synced: false

#### `db.updateJobStatus(id, status)`
**Purpose:** Update job status

**Parameters:**
- `id`: Job identifier
- `status`: New status ('Pending' | 'In Progress' | 'Completed')

**Side Effects:**
- Updates status and updatedAt
- Tracks dirtyFields: ['status']
- Updates fieldTimestamps: { status: timestamp }
- Queues update operation
- Marks synced: false

#### `db.updateJob(id, fields)`
**Purpose:** Update job fields

**Parameters:**
- `id`: Job identifier
- `fields`: Partial<Job> object with fields to update

**Side Effects:**
- Updates specified fields
- Tracks dirtyFields with changed field names
- Updates fieldTimestamps for each changed field
- Queues update operation
- Marks synced: false

#### `db.deleteJob(id)`
**Purpose:** Delete a job

**Parameters:**
- `id`: Job identifier

**Side Effects:**
- If job was created offline (not synced): deletes immediately
- If job was synced: marks isDeleted: true
- Queues delete operation
- Cancels pending updates for same job

### Sync Queue API

#### `enqueueCreate(table, job)`
**Purpose:** Queue a create operation

**Parameters:**
- `table`: syncQueue Dexie table
- `job`: Full Job object

**Queue Item Structure:**
```typescript
{
  entityId: job.id,
  jobTitle: job.title,
  action: 'create',
  payload: job,
  clientTimestamp: Date.now(),
  retryCount: 0,
  status: 'pending'
}
```

#### `enqueueUpdate(table, entityId, fields, jobTitle)`
**Purpose:** Queue an update operation

**Features:**
- Collapses with pending create (merges fields)
- Collapses with pending update (merges fields)
- Prevents duplicate queue items

#### `enqueueDelete(table, entityId, payload, jobTitle)`
**Purpose:** Queue a delete operation

**Features:**
- Cancels pending create (no server delete needed)
- Removes pending updates for same job
- Collapses with pending delete

### Sync Engine API

#### `syncEngine.processQueue()`
**Purpose:** Process all pending sync queue items

**Behavior:**
- Checks online status
- Processes items sequentially (not parallel)
- Respects retry backoff delays
- Handles individual item failures
- Updates sync status

#### `syncEngine.startRemoteListener()`
**Purpose:** Subscribe to Firestore real-time changes

**Behavior:**
- Uses Firestore onSnapshot
- Detects remote changes
- Merges with local data
- Skips jobs with pending local changes
- Automatic on network change

#### `syncEngine.initialLoadFromFirestore()`
**Purpose:** Load all jobs from Firestore (for fresh installations)

**Behavior:**
- Fetches all jobs from Firestore
- Adds to local IndexedDB if not present
- Used when local DB is empty

### Conflict Resolution API

#### `resolveLastWriteWins(localJob, remoteJob)`
**Purpose:** Document-level conflict resolution

**Algorithm:**
1. Compare localJob.updatedAt vs remoteJob.updatedAt
2. If remote is newer → return remote (synced: true)
3. If local is newer → return local (synced: false)

#### `mergeFieldLevel(localJob, remoteJob, locallyChangedFields)`
**Purpose:** Field-level conflict resolution

**Algorithm:**
1. For each locally changed field:
   - Compare field-level timestamps
   - Keep newer version (local or remote)
   - Track conflicts
2. Merge fieldTimestamps from remote
3. Clear dirtyFields after merge
4. Return merged job with conflict details

**Returns:**
```typescript
{
  winner: 'local' | 'remote' | 'merged',
  mergedJob: Job,
  conflictedFields: string[],
  conflictDetails: FieldConflict[]
}
```

#### `detectChangedFields(localJob, remoteJob)`
**Purpose:** Detect which fields differ between local and remote

**Algorithm:**
1. Iterate through all job fields
2. Compare values
3. Ignore metadata fields (id, createdAt, updatedAt, synced, etc.)
4. Return array of changed field names

## Type Definitions

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
  dirtyFields?: string[]
  fieldTimestamps?: Record<string, string>
}
```

### Sync Queue Item

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

### Conflict Resolution Types

```typescript
interface ConflictMergeResult {
  winner: 'local' | 'remote' | 'merged'
  mergedJob: Job
  conflictedFields: string[]
  conflictDetails: FieldConflict[]
}

interface FieldConflict {
  field: string
  localValue: any
  remoteValue: any
  localTimestamp?: string
  remoteTimestamp?: string
}
```

## State Management

### Reactive State (Vue 3)

```typescript
// useJobs composable
{
  jobs: Ref<Job[]>
  isLoading: Ref<boolean>
  searchQuery: Ref<string>
  selectedStatus: Ref<string>
  totalJobs: ComputedRef<number>
  pendingJobs: ComputedRef<number>
  inProgressJobs: ComputedRef<number>
  completedJobs: ComputedRef<number>
  filteredJobs: ComputedRef<Job[]>
}

// useSyncQueue composable
{
  pendingCount: Ref<number>
  queueItems: Ref<SyncQueueItem[]>
  isSyncing: Ref<boolean>
  isOnline: Ref<boolean>
  lastSyncTime: Ref<string | null>
  syncError: Ref<string | null>
}
```

### Database State (IndexedDB)

```
fieldflow_db
├── jobs (7 indexes)
│   ├── Primary: id
│   ├── customer
│   ├── status
│   ├── priority
│   ├── scheduledDate
│   ├── updatedAt
│   ├── synced
│   └── isDeleted
│
└── syncQueue (4 indexes)
    ├── Primary: ++id
    ├── entityId
    ├── action
    ├── status
    └── clientTimestamp
```

## Performance Characteristics

### IndexedDB Operations
- **Read:** < 10ms (indexed queries)
- **Write:** < 20ms (single transaction)
- **Bulk Write:** < 100ms (10 items)

### Firebase Operations
- **Read:** < 200ms (document get)
- **Write:** < 300ms (document set)
- **Query:** < 500ms (collection query)
- **Real-time:** < 100ms (onSnapshot update)

### Sync Queue Processing
- **Single item:** < 500ms
- **10 items:** < 3s (sequential)
- **Retry backoff:** 1s → 2s → 4s → 8s → 16s → 30s (max)

## Security Model

### Firebase Firestore Rules (Development)
```javascript
match /jobs/{jobId} {
  allow read, write: if true;
}
```

### Firebase Firestore Rules (Production)
```javascript
match /jobs/{jobId} {
  allow read, write: if request.auth != null;
}
```

### Environment Variables
- Stored in `.env.local` (never committed)
- Accessed via Vite `import.meta.env.VITE_*`
- Firebase credentials never exposed in client code

## Error Handling

### Sync Errors
- **Network failure:** Retry with exponential backoff
- **Permission denied:** Display error in UI, queue for retry
- **Conflict:** Merge with last-write-wins or field-level
- **Max retries:** Mark as failed, allow manual retry

### Database Errors
- **IndexedDB blocked:** Fallback to memory storage (not implemented)
- **Transaction failed:** Rollback, notify user
- **Storage quota:** Clear old data, notify user

## Deployment Architecture

### Development
```
Vite Dev Server (localhost:5173)
├── Hot module replacement
├── Source maps
├── Unminified code
└── Service worker (dev mode)
```

### Production
```
Static Files (dist/)
├── index.html
├── manifest.webmanifest
├── sw.js (service worker)
├── assets/
│   ├── index-*.js (minified, chunked)
│   └── index-*.css (minified)
└── PWA manifest
```

### Deployment Options
- **Vercel:** Static site deployment
- **Netlify:** Static site deployment
- **Firebase Hosting:** Direct integration with Firestore
- **GitHub Pages:** Static site deployment

## Monitoring & Debugging

### Console Logging
- `[SyncEngine]` - Sync operations
- `[useJobs]` - Job operations
- `[useSyncQueue]` - Queue operations
- `[Conflict]` - Conflict resolution

### DevTools Inspection
- **Application → IndexedDB** - View database state
- **Application → Service Workers** - View SW status
- **Network** - Monitor Firebase requests
- **Console** - View logs and errors

### Firebase Console
- **Firestore Database** - View remote data
- **Realtime Database** - (not used)
- **Authentication** - (not configured)
- **Crashlytics** - (not configured)

## Scalability Considerations

### IndexedDB
- **Limit:** 50MB per origin (browser dependent)
- **Optimization:** Index queries, limit result sets
- **Future:** Add data pagination, old data archival

### Firebase Firestore
- **Limit:** 1GB free tier
- **Cost:** $0.18/GB after free tier
- **Optimization:** Selective field loading, pagination
- **Future:** Implement data retention policy

### Sync Queue
- **Limit:** No hard limit (IndexedDB)
- **Optimization:** Mutation collapsing, size limits
- **Future:** Queue size monitoring, auto-cleanup

## Future Enhancements

### Phase 8 (Potential)
- User authentication
- Role-based permissions
- File attachments (photos, documents)
- Geolocation tracking
- Push notifications
- Offline-first forms (advanced)
- Data export/import
- Analytics dashboard
- Multi-tenant support
