# IG Account Processor

A local-first Android application for importing, organizing, reviewing, processing, and exporting large collections of social-media account records.

The application is built with **Expo**, **React Native**, **TypeScript**, **Expo Router**, and **SQLite**. Its primary workflow is intentionally manual: it helps the user manage imported account data and open external social profiles, while keeping account records, processing decisions, import history, lists, images, and settings on the device.

> **Current implementation:** the repository is structured as a React Native / Expo application and targets Android. The README describes the behavior implemented in the `main` branch.

---

## Table of Contents

- [What the app does](#what-the-app-does)
- [Design principles](#design-principles)
- [Main workflow](#main-workflow)
- [Supported import formats](#supported-import-formats)
- [Import pipeline](#import-pipeline)
- [Account identity and normalization](#account-identity-and-normalization)
- [Processing queue](#processing-queue)
- [Account records](#account-records)
- [Lists](#lists)
- [Images](#images)
- [Import history and undo](#import-history-and-undo)
- [Export](#export)
- [Backup, restore, and hard reset](#backup-restore-and-hard-reset)
- [Settings](#settings)
- [Application screens](#application-screens)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Database design](#database-design)
- [Performance considerations](#performance-considerations)
- [Error handling](#error-handling)
- [Accessibility and UI behavior](#accessibility-and-ui-behavior)
- [Development setup](#development-setup)
- [Available scripts](#available-scripts)
- [Testing](#testing)
- [Android build](#android-build)
- [Data and privacy](#data-and-privacy)
- [Important implementation boundaries](#important-implementation-boundaries)

---

## What the app does

IG Account Processor turns heterogeneous account datasets into a searchable, locally stored account library.

A typical workflow is:

1. Select an account-data file with the Android document picker.
2. Detect the actual file format from content, extension, and MIME information.
3. Parse records into a common internal representation.
4. Normalize Instagram, X, and TikTok handles and profile URLs.
5. Detect records that already exist locally and identify possible Instagram username changes.
6. Preview import statistics before committing the data.
7. Save records and provenance information into SQLite.
8. Download usable profile images in the background with bounded concurrency.
9. Process accounts one at a time using the queue.
10. Assign a status such as `Followed`, `Skipped`, `No Instagram`, or `Check Later`.
11. Group accounts into named lists.
12. Review account-level and import-level history.
13. Export filtered data or create a complete application backup.

The application deliberately keeps these responsibilities separate: file parsing and normalization do not depend on the UI, database access is centralized in repository modules, and UI screens compose those services.

---

## Design principles

### Filename-independent imports

A file's name is retained as provenance, but it is not trusted as the schema.

The parser supports misleading extensions and determines formats using the combination of:

- file content
- extension
- MIME type
- structural patterns

This is particularly important for datasets whose filenames vary between sources or are generated automatically.

### Data preservation

The application creates normalized fields for practical searching and processing, but it also keeps the original imported row as JSON in `raw_data_json`.

This means an importer can understand known fields without discarding fields it does not recognize.

### Local-first storage

The main application data is stored locally:

- accounts
- status history
- import history
- lists
- image metadata
- downloaded image paths
- username-change history
- application settings

No server-side account database is required for normal operation.

### Manual external-profile interaction

The Instagram integration is deliberately narrow.

The application can open an Instagram profile using an `instagram://` deep link when configured to prefer the app, with an optional browser fallback. It does not implement Instagram authentication or automated account actions.

The same account record can also contain X and TikTok usernames/links, which are opened through normal external URLs.

### Predictable processing

The queue stores status decisions in SQLite rather than relying on transient React state.

Status transitions are persisted and historical transitions are recorded separately, while the queue can optionally move automatically to the next account.

---

## Main workflow

```text
                       +-------------------+
                       |  Select a file     |
                       +---------+---------+
                                 |
                                 v
                       +-------------------+
                       | Format detection  |
                       | + parsing         |
                       +---------+---------+
                                 |
                                 v
                       +-------------------+
                       | Field extraction  |
                       | + normalization   |
                       +---------+---------+
                                 |
                                 v
                       +-------------------+
                       | Import analysis   |
                       | duplicates /      |
                       | updates / changes |
                       +---------+---------+
                                 |
                                 v
                       +-------------------+
                       | SQLite persistence|
                       +---------+---------+
                                 |
                    +------------+------------+
                    |                         |
                    v                         v
             +-------------+           +-------------+
             | Processing  |           | Lists /     |
             | queue       |           | browsing    |
             +------+------+           +------+------+
                    |                         |
                    +------------+------------+
                                 |
                                 v
                       +-------------------+
                       | History / Export |
                       | / Backup         |
                       +-------------------+
```

---

## Supported import formats

The parser recognizes:

| Format | Support |
|---|---|
| JSON | Yes |
| JSONL | Yes |
| NDJSON | Yes |
| CSV | Yes |
| TSV | Yes |
| XLSX | Yes |
| XLS | Yes |
| TXT | Yes |
| XML | Yes |
| HTML | Yes |

Spreadsheet files are read as Base64/binary content because the Expo file APIs provide them differently from text files.

### JSON handling

The importer understands both ordinary arrays and common object-wrapped collections.

Recognized collection keys include:

- `models`
- `accounts`
- `users`
- `profiles`
- `data`
- `items`
- `results`
- `records`
- `rows`
- `followers`
- `following`
- `relationships_following`
- `relationships_followers`

Instagram export structures using `string_list_data` are flattened into account records.

### Delimited text handling

CSV/TSV parsing handles:

- UTF-8 BOM
- CRLF and LF line endings
- quoted cells
- escaped double quotes
- embedded commas inside quoted values
- header-based files
- headerless data

Known header names are normalized so variations such as `Instagram Username`, `instagram_username`, and `instagramUsername` can resolve to the same logical field.

### XML and HTML

XML import looks for common record-like elements such as:

- `record`
- `item`
- `person`
- `model`
- `account`

HTML import looks primarily for links and recognizes Instagram profile URLs in anchor elements. HTML imports that do not expose clean record structures can still be preserved as extracted text and may require manual mapping.

---

## Import pipeline

The importer is split into two important layers.

### 1. `services/fileParser.ts`

Responsible for:

- format detection
- JSON parsing
- CSV parsing
- TSV parsing
- JSONL/NDJSON parsing
- XLS/XLSX parsing
- XML extraction
- HTML extraction
- empty-file detection
- malformed-input errors

The parser returns a common shape:

```ts
interface ParsedFile {
  format: DetectedFormat;
  rows: ParsedRow[];
  warnings: string[];
}
```

### 2. `services/importService.ts`

Responsible for converting parsed rows into canonical account records.

It extracts:

- model name
- letter/alphabet
- Instagram username
- Instagram URL
- X username
- X URL
- TikTok username
- TikTok URL
- profile-image URL
- source URL
- notes
- original row data

It also calculates import statistics including:

- total records
- new records
- updated/existing records
- duplicate rows
- invalid rows
- records with/without Instagram
- records with/without images
- placeholder-image count
- detected fields
- warnings
- possible username changes

The UI shows this analysis before the user commits the import.

---

## Account identity and normalization

### Instagram normalization

Instagram values are normalized through the utility layer.

Examples of accepted input styles include:

```text
@ExampleUser
exampleuser
https://instagram.com/ExampleUser
https://www.instagram.com/ExampleUser/
https://m.instagram.com/ExampleUser/
https://instagram.com/_u/ExampleUser/
```

The stored username is lowercased and stripped of the `@` prefix and URL components.

### Ignored Instagram routes

The application does not interpret non-profile Instagram routes as usernames.

Ignored path segments include values such as:

```text
explore
accounts
reels
reel
p
stories
direct
tv
about
legal
developer
web
api
graphql
embed
privacy
terms
session
challenge
lite
```

### Structural validation

The app performs local structural validation only.

A normalized username must:

- be non-empty
- be at most 30 characters
- contain only letters, digits, periods, and underscores
- not start or end with a period
- not contain consecutive periods

This validation does **not** contact Instagram and does not prove that an account currently exists.

### X and TikTok

X/Twitter and TikTok profile URLs are normalized to their handles and stored alongside Instagram information.

Examples:

```text
https://x.com/example       -> example
https://twitter.com/example -> example

https://www.tiktok.com/@example -> example
```

The app does not invent a missing social username from a model name.

### Records without Instagram

An imported record does not have to contain an Instagram username.

For such rows, the importer constructs a stable identity key from available provenance such as:

- source URL
- image URL
- model name
- letter
- a hash of the raw row when stronger identity inputs are unavailable

This allows rows without Instagram accounts to remain visible, editable, listable, and exportable.

---

## Processing queue

The processing screen is designed for repetitive account-by-account review.

### Queue modes

The queue supports:

- `UNPROCESSED` — new/unprocessed accounts
- `ALL` — all accounts
- `STATUS` — accounts with a selected status

The queue can also be scoped to a specific list.

### Navigation

The queue supports:

- next account
- previous account
- starting from a specific account
- position tracking
- remaining-count tracking
- continuing where the user left off

The current implementation intentionally behaves differently for forward and backward navigation:

- **Next** follows the selected processing mode.
- **Previous** walks the complete scoped dataset so an earlier decision can be reviewed.

### Statuses

The supported status values are:

| Status | Purpose |
|---|---|
| `NEW` | Not yet processed |
| `FOLLOWED` | Account was followed |
| `SKIPPED` | Intentionally skipped |
| `UNAVAILABLE` | Account/profile unavailable |
| `ALREADY_FOLLOWING` | Already followed |
| `NOT_INTERESTED` | Marked as not interesting |
| `NO_INSTAGRAM` | No Instagram account available |
| `IMAGE_UNAVAILABLE` | Expected profile image is unavailable |
| `CHECK_LATER` | Requires later review |

Status changes are persisted in the `accounts` table and also appended to `status_history`.

### Undo

Changing a status creates a temporary undo action.

The queue keeps the previous state for a short window and can restore it without requiring the user to navigate away from the current account.

---

## Account records

Each account can contain substantially more than an Instagram username.

The main account model includes:

- database ID
- model name
- letter
- Instagram username and URL
- X username and URL
- TikTok username and URL
- display name
- full name
- remote profile-image URL
- local image URI/path
- source URL
- source file name
- source file type
- source MIME type
- source row number
- source import ID
- original raw row JSON
- processing status
- notes
- list ID
- creation timestamp
- update timestamp
- last processed timestamp
- source label

This design separates user-facing metadata from the original imported payload.

---

## Lists

Lists are stored as first-class local entities.

The list layer supports:

- creating lists
- renaming lists
- deleting lists
- moving accounts between lists
- browsing accounts within a list
- counting accounts per list
- calculating processed/new counts
- counting accounts with Instagram usernames

A list is associated with accounts through `list_accounts`, while `accounts.list_id` is also maintained for direct account-level lookup.

Deleting a list can either:

- remove the list and detach its accounts, or
- remove the list and delete the associated accounts

depending on the operation selected by the UI.

---

## Images

Images use a two-level storage model.

### Remote data

The imported remote image URL is stored in SQLite.

### Local data

The actual downloaded image file is stored in the application's filesystem.

SQLite stores the corresponding local path and image metadata rather than embedding the image bytes in the database.

### Image download behavior

Image downloads:

- accept only HTTP(S) URLs
- ignore known placeholder images
- create an application-owned image directory
- reuse an existing local file where possible
- write/update the account's local image URI
- maintain an `account_images` record
- expose progress for bulk downloads

Bulk downloads use a bounded worker pool rather than creating an unbounded number of simultaneous requests.

The current concurrency constant is:

```ts
IMAGE_DOWNLOAD_CONCURRENCY = 4
```

### Placeholder handling

The importer explicitly recognizes the generic Babepedia advanced-search placeholder:

```text
https://www.babepedia.com/images/advanced-search.png
```

It is not treated as a genuine profile image and is not bulk-downloaded.

### Device export

The account details screen can save an image to user-selected Android storage through the Storage Access Framework.

The selected directory URI is remembered in application settings.

---

## Import history and undo

Every committed import has a corresponding entry in `app_imports`.

Import-level statistics include:

- source filename
- source file type
- MIME type
- source size
- import timestamp
- total records
- new records
- updated records
- duplicates
- records with/without Instagram
- records with/without images
- placeholder-image count
- warning count
- error count

Each imported account can also be linked to its import through `app_import_accounts`.

### Safe import rollback

The app preserves information needed to reverse an import.

For accounts created by an import, undo can remove the newly created account when the stored ownership/source relationship still matches that import.

For accounts that existed before an import, the previous account JSON is retained so that imported changes can be restored.

The implementation also records Instagram username changes separately in `account_username_history`.

---

## Export

The export screen can filter by:

- all accounts
- a specific processing status
- a specific list

Supported output formats are:

- JSON
- CSV
- TXT
- XLSX

### CSV and XLSX

These exports include fields such as:

- Model Name
- Letter
- Instagram Username
- Instagram Link
- X Username
- X Link
- TikTok Username
- TikTok Link
- ProfilePicUrl
- Local Image Path
- Babepedia Source
- Source File
- Status
- Notes
- Created At
- Updated At

### TXT

TXT output writes available Instagram, X, and TikTok handles one account per line.

### JSON

JSON contains an `exportedAt` timestamp and an `accounts` array using the export field names.

### Spreadsheet/CSV safety

CSV and XLSX values are protected against spreadsheet formula injection by prefixing values that begin with characters such as:

```text
=
+
-
@
tab
carriage return
```

The generated file is shared through Expo's sharing API.

---

## Backup, restore, and hard reset

Backups are distinct from ordinary exports.

An ordinary export is intended for exchanging account data.

A backup is intended to reconstruct the local application state.

### Backup contents

The backup includes data from the application's local tables, including:

- lists
- accounts
- status history
- import history
- account-image records
- list memberships
- application import metadata
- account/import relationships
- Instagram username history
- settings

The backup has an application marker and explicit format version.

Current backup metadata is structured around:

```json
{
  "app": "ig-account-processor",
  "format": 2,
  "exported_at": "...",
  "data": {}
}
```

### Restore validation

Before replacing local data, the restore flow checks:

- JSON validity
- application identifier
- supported backup format
- required arrays
- account object structure
- duplicate Instagram usernames

Optional tables from older backups are filled with empty arrays where appropriate for compatibility.

The database replacement itself is performed inside an exclusive SQLite transaction.

### Hard reset

Settings contains a destructive **Hard Reset** operation.

The user must type:

```text
RESET
```

exactly before the reset executes.

The operation clears local application data including accounts, images, lists, status history, import history, and settings, and removes the application's local image directory.

It does not perform any action against Instagram.

---

## Settings

The settings service uses AsyncStorage for application preferences.

Current settings include:

| Setting | Default |
|---|---|
| Theme | System |
| Auto-next after status | Enabled |
| Confirm status changes | Disabled |
| Default account filter | All |
| Prefer Instagram app | Enabled |
| Browser fallback | Enabled |
| Queue mode | Unprocessed |
| Queue status | Skipped |
| Onboarding complete | Disabled until finished |
| Image save directory | None |

Settings are loaded once and exposed through a small subscription-based state layer.

---

## Application screens

The Expo Router file structure maps directly to the major application flows.

### Dashboard — `app/index.tsx`

The dashboard shows:

- total accounts
- processed count
- per-status counts
- a shortcut to continue from the first new account
- navigation to import, queue, lists, statistics, all accounts, history, and settings

### Import — `app/import.tsx`

Provides:

- Android file selection
- file validation
- format detection
- import analysis
- record statistics
- detected-field display
- username-change preview
- progress during database insertion
- progress during image downloads

### Queue — `app/queue.tsx`

Provides:

- scoped processing
- status selection
- previous/next navigation
- automatic next-account behavior
- optional confirmation
- status undo
- profile actions
- image viewing/download
- list association

### All Accounts — `app/accounts.tsx`

Wraps the reusable account browser around an empty filter set.

### Account details — `app/account/[id].tsx`

Provides a complete account view with:

- profile image
- Instagram/X/TikTok handles
- external profile buttons
- source information
- timestamps
- list assignment
- status controls
- notes
- username-change history
- status history
- image download actions

### Lists — `app/lists/index.tsx` and `app/lists/[id].tsx`

Provides list creation and management, plus filtered account browsing.

### Statistics — `app/statistics.tsx`

Shows:

- total imported accounts
- processed vs. new
- processing percentage
- status distribution
- per-list processing progress
- unassigned-account progress

### Import History — `app/history/index.tsx` and `app/history/[id].tsx`

Provides import-batch browsing and batch-level details.

### Export — `app/export.tsx`

Provides status/list filtering, format selection, account counts, and file sharing.

### Settings — `app/settings.tsx`

Provides:

- appearance selection
- processing preferences
- Instagram opening preferences
- account export
- database backup
- database restore
- hard reset
- application version

### Root layout — `app/_layout.tsx`

The root layout:

1. initializes the local SQLite database
2. loads settings
3. sets the correct status-bar appearance
4. shows a database-unavailable state when initialization fails
5. displays onboarding until it is completed
6. mounts the Expo Router stack

---

## Architecture

The application follows a layered structure:

```text
UI / Screens
    |
    v
Components + hooks
    |
    v
Services
    |
    v
Database repositories
    |
    v
Expo SQLite / filesystem / AsyncStorage
```

### UI layer

`app/` contains route-level screens.

`components/` contains reusable UI elements such as:

- account cards
- account browsers
- search/filter controls
- dialogs
- progress bars
- status buttons
- full-screen image viewer
- undo bar

### Service layer

`services/` contains application behavior that should not be embedded directly into presentation components.

Important services include:

| File | Responsibility |
|---|---|
| `fileParser.ts` | Multi-format file parsing |
| `importService.ts` | Import analysis and normalized records |
| `instagram.ts` | External Instagram profile opening |
| `profileImage.ts` | Image/profile metadata helpers |
| `imageDownloadService.ts` | Local image caching/export |
| `exportService.ts` | CSV/TXT/JSON/XLSX generation |
| `backupService.ts` | Complete app backup/restore |
| `usernameExtractor.ts` | Extract usernames from arbitrary text |
| `settingsService.ts` | Persisted preferences |
| `errors.ts` | User-facing application errors |

### Database layer

`database/` contains repository-style modules around SQLite.

Important modules include:

| File | Responsibility |
|---|---|
| `database.ts` | Connection, migrations, schema verification, reset |
| `schema.ts` | Initial schema and forward migrations |
| `accounts.ts` | Account queries, inserts, updates, status, queue |
| `lists.ts` | List CRUD and statistics |
| `history.ts` | Import and account history |
| `backup.ts` | Dump/replace local database data |
| `interfaces.ts` | Repository contracts |
| `index.ts` | Database exports |

### Type layer

`types/` provides shared TypeScript contracts for accounts, lists, history, and backup files.

### Utility layer

`utils/` provides:

- constants
- normalization
- validation
- date/formatting helpers
- theme definitions
- settings hooks
- theme hooks
- debouncing

---

## Project structure

The repository currently follows this layout:

```text
ig-account-processor/
├── .github/
│   └── workflows/
│       └── validate.yml
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── import.tsx
│   ├── queue.tsx
│   ├── accounts.tsx
│   ├── export.tsx
│   ├── statistics.tsx
│   ├── settings.tsx
│   ├── account/
│   │   └── [id].tsx
│   ├── history/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   └── lists/
│       ├── index.tsx
│       └── [id].tsx
├── components/
│   ├── AccountBrowser.tsx
│   ├── AccountCard.tsx
│   ├── ConfirmDialog.tsx
│   ├── EmptyState.tsx
│   ├── FilterBar.tsx
│   ├── FullScreenImage.tsx
│   ├── ImportPreview.tsx
│   ├── ListPickerDialog.tsx
│   ├── Onboarding.tsx
│   ├── ProgressBar.tsx
│   ├── SearchBar.tsx
│   ├── StatusButton.tsx
│   ├── TextPromptDialog.tsx
│   └── UndoBar.tsx
├── database/
│   ├── accounts.ts
│   ├── backup.ts
│   ├── database.ts
│   ├── history.ts
│   ├── index.ts
│   ├── interfaces.ts
│   ├── lists.ts
│   └── schema.ts
├── services/
│   ├── backupService.ts
│   ├── errors.ts
│   ├── exportService.ts
│   ├── fileParser.ts
│   ├── imageDownloadService.ts
│   ├── importService.ts
│   ├── instagram.ts
│   ├── profileImage.ts
│   ├── settingsService.ts
│   └── usernameExtractor.ts
├── tests/
│   ├── fixtures/
│   │   ├── QModels-2.csv
│   │   └── QModels.json
│   └── importService.test.mjs
├── types/
│   ├── account.ts
│   ├── backup.ts
│   ├── history.ts
│   └── list.ts
├── utils/
│   ├── constants.ts
│   ├── format.ts
│   ├── normalization.ts
│   ├── theme.ts
│   ├── useDebouncedValue.ts
│   ├── useSettings.ts
│   ├── useTheme.ts
│   └── validation.ts
├── app.json
├── babel.config.js
├── eas.json
├── package.json
├── package-lock.json
└── tsconfig.json
```

---

## Database design

The SQLite schema is forward-migrated using `PRAGMA user_version`.

The application enables:

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
```

### Core tables

#### `accounts`

The main account table.

It stores normalized identity data, metadata, processing state, provenance, and local image paths.

Important indexes exist for:

- username
- X username
- TikTok username
- model name
- status
- letter
- created timestamp
- updated timestamp
- source import
- identity key

#### `lists`

Stores named user-created groups.

#### `list_accounts`

Many-to-one/membership relationship between lists and accounts.

#### `status_history`

Append-only record of account status transitions.

#### `account_images`

Stores remote/local image relationships, download status, image type, and timestamps.

#### `app_imports`

Stores import-batch-level metadata and statistics.

#### `app_import_accounts`

Associates account rows with an import batch and retains information needed for safe rollback.

#### `account_username_history`

Stores Instagram username changes detected between imports.

#### `settings`

Provides a SQLite settings table for schema completeness/compatibility; runtime application preferences are persisted through the settings service using AsyncStorage.

### Forward migrations

The repository currently defines migrations through version 12.

The migration history progressively adds:

- richer account metadata
- image records
- import-batch architecture
- settings table
- full-name/image URI fields
- username history
- X metadata
- TikTok metadata
- import rollback information

The database also performs a startup schema verification and reports missing required columns/tables as a `DatabaseError`.

---

## Performance considerations

Several parts of the implementation are deliberately designed for larger datasets.

### Paginated browsing

Account browsers load pages rather than placing the entire dataset into React state.

### Batched inserts

Imports are persisted in batches, allowing UI progress updates during large imports.

### SQLite indexes

Frequently searched and filtered account fields have explicit indexes.

### Controlled image concurrency

Bulk image downloads use four workers instead of launching unlimited requests.

### Incremental list statistics

List statistics are calculated through SQL aggregation rather than requiring the full account dataset to be loaded into JavaScript.

### Queue navigation

The processing queue retrieves adjacent account IDs through filtered SQL queries rather than constructing an in-memory queue for every account.

---

## Error handling

The application uses domain-level errors rather than exposing raw SQLite/filesystem errors directly to the UI.

`services/errors.ts` provides a common conversion path for user-facing messages.

Examples of handled failure modes include:

- malformed JSON
- malformed CSV/TSV quoting
- malformed JSONL/NDJSON
- invalid spreadsheets
- missing files
- empty files
- unavailable sharing
- unavailable storage
- failed image downloads
- missing database schema
- failed database writes
- invalid backups
- corrupted backups

The import flow also cleans up an import-batch record when a database save fails before the account transaction has been committed.

---

## Accessibility and UI behavior

The UI includes explicit accessibility information for important controls.

Examples include:

- `accessibilityRole`
- `accessibilityLabel`
- `accessibilityState`
- `accessibilityLiveRegion`
- header semantics
- labels for status changes
- labels for search and clear actions
- labels for image zoom/full-screen controls

Status is never communicated through color alone: status buttons also use symbols and text.

The application also supports:

- system/light/dark themes
- safe-area-aware React Native layouts
- explicit loading and empty states
- disabled-state feedback
- confirmation dialogs for destructive actions

---

## Development setup

### Requirements

- Node.js 18 or newer
- Android device or emulator
- npm
- Expo CLI/tooling through the project dependencies

### Install

```bash
npm install
```

It can be useful to verify that installed Expo package versions match the project's expected versions:

```bash
npx expo install --check
```

### Typecheck

```bash
npm run typecheck
```

### Tests

```bash
npm test
```

### Start Expo

```bash
npx expo start
```

### Android development build

```npm
npm run android
```

This maps to:

```bash
expo run:android
```

---

## Available scripts

The project's `package.json` currently defines:

| Script | Command | Purpose |
|---|---|---|
| `start` | `expo start` | Start Metro/Expo |
| `android` | `expo run:android` | Build/run the Android development target |
| `typecheck` | `tsc --noEmit` | TypeScript validation |
| `test` | `tsx --test tests/**/*.test.mjs` | Run the test suite |

---

## Testing

The repository includes automated tests focused on the import and normalization layer.

The test fixture directory currently includes:

```text
tests/fixtures/QModels.json
tests/fixtures/QModels-2.csv
```

The import test suite exercises behaviors such as:

- filename-independent parsing
- QModels-style JSON and CSV
- Instagram follower/following export structures
- HTML Instagram links
- quoted CSV fields
- BOM handling
- CRLF handling
- missing Instagram values
- JSONL and NDJSON
- TSV
- misleading extensions
- malformed input
- duplicate detection
- username normalization
- account identity behavior

For larger datasets, practical on-device testing should include:

```text
1,000 records
10,000 records
25,000 records
50,000 records
```

Additional manual validation areas include:

- image downloading
- image saving to device storage
- backup/restore
- hard reset
- system/light/dark themes
- accessibility controls
- Instagram installed/uninstalled behavior
- browser fallback
- queue auto-next
- queue undo
- list assignment
- export in every supported format

---

## Android build

The repository includes EAS configuration in `eas.json`.

A typical EAS flow is:

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android
```

The exact EAS credentials and project configuration are intentionally environment-specific and should not be committed as secrets.

---

## Data and privacy

The core application has:

- no application login system
- no Instagram credential storage
- no cloud database required for operation
- no analytics implementation
- no cloud synchronization layer

Imported account information is stored locally unless the user explicitly:

- exports account data
- shares a generated backup/export
- saves an image to an externally selected Android directory

The application stores raw imported rows and source/provenance information, so users should treat the local database and exported backup files as potentially sensitive.

---

## Important implementation boundaries

### The app does not log into Instagram

The Instagram integration is intentionally limited to opening profile links.

The source code does not implement:

- Instagram username/password authentication
- credential storage
- follow/unfollow automation
- like automation
- comment automation
- direct-message automation
- simulated taps
- browser automation
- scraping of Instagram pages
- bypassing account restrictions

### Profile metadata is not scraped from Instagram

The profile metadata helpers operate on values already supplied by the imported dataset or local account record.

A successful `fetchProfileMetadata()` call does not mean the app contacted Instagram. It resolves the metadata fields already available to the application.

### Username validation is structural

A syntactically valid username is not proof that the corresponding Instagram account exists.

### Backups are different from exports

Exports are intended to produce portable account datasets.

Backups are intended to reproduce the application's local state, including history, lists, image metadata, imports, and settings.

---

## Technology stack

| Layer | Technology |
|---|---|
| Runtime | React Native |
| App framework | Expo |
| Navigation | Expo Router |
| Language | TypeScript |
| UI | React Native components |
| Local database | Expo SQLite |
| Key-value preferences | AsyncStorage |
| File selection | Expo Document Picker |
| Filesystem | Expo File System |
| Sharing | Expo Sharing |
| Spreadsheets | SheetJS / `xlsx` |
| Icons | Expo Vector Icons |
| Animations/gestures | React Native Reanimated + Gesture Handler |
| Validation/tests | TypeScript + `tsx` test runner |

---

## License

No explicit software license file is currently included in the repository. Unless a license is added, the repository should be treated as having no blanket open-source license beyond the rights granted by applicable copyright law.

---

## Repository status

This README documents the implementation visible in the current `main` branch. As features evolve, update the documentation alongside changes to the import contract, database schema, supported formats, settings, and user-facing workflows.
