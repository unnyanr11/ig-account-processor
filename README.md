# IG Account Processor

Local-first Android app for reviewing imported Instagram-related account datasets and manually processing them one by one.

Built with Expo + React Native + TypeScript + Expo Router + SQLite.

---

## What this project does

IG Account Processor helps you:

1. Import account data from many file formats.
2. Normalize usernames/links for Instagram, X, and TikTok.
3. Process each account with status tracking.
4. Organize accounts into lists.
5. Keep full import history (with undo per import batch).
6. Export filtered account data.
7. Backup and restore complete local app data.

The app is explicitly **manual-use only** for Instagram. It can open profile links, but it does not log in, scrape pages, or automate interactions.

---

## Core project functionality

### 1) Dashboard
- Shows total accounts, processed accounts, and status-wise counts.
- Provides quick actions to Import, Continue Processing, Lists, Statistics, All Accounts, Import History, and Settings.
- Supports “resume from first NEW account.”

### 2) Import pipeline
- Uses Android document picker to select files.
- Detects format from content + MIME + extension (filename is not trusted as schema).
- Supported formats:
  - JSON
  - JSONL / NDJSON
  - CSV
  - TSV
  - XLSX / XLS
  - TXT
  - XML
  - HTML
- Handles:
  - BOM, CRLF/LF, quoted CSV, embedded commas
  - Header-based and headerless delimited input
  - Instagram followers/following export shapes (`string_list_data`, `relationships_following`, `relationships_followers`)
- Normalizes and extracts:
  - Instagram username/link
  - X username/link
  - TikTok username/link
  - model name, letter, source URL, notes, image URL
- Detects duplicate rows within import input.
- Detects username-change candidates against existing records.
- Saves import metadata + links imported accounts to the import batch.
- Optionally queues image downloads after import.

### 3) Processing queue
- Walks accounts in sequence with previous/next navigation.
- Queue modes:
  - Unprocessed only
  - All accounts
  - Selected status
- Status options:
  - New
  - Followed
  - Skipped
  - Unavailable
  - Already Following
  - Not Interested
  - No Instagram
  - Image Unavailable
  - Check Later
- Supports:
  - one-tap status updates
  - optional confirmation before status change
  - auto-next mode
  - temporary undo bar for recent status change
  - opening Instagram/X/TikTok/source links
  - image preview and save-to-device flow

### 4) Account browser + account details
- Paged account listing with search + status filter.
- Account detail screen includes:
  - profile image/full-screen preview
  - metadata edit/update behaviors (status, notes, list assignment)
  - status history timeline
  - username-change history timeline
  - metadata/source information and timestamps

### 5) Lists
- Create, rename, and delete lists.
- View list-level stats (total/processed/new).
- Process queue scoped to a specific list.
- Delete list only, or delete list and all linked accounts.

### 6) Import history
- Shows all import batches with record metrics.
- Batch detail includes imported/affected accounts.
- Undo entire import:
  - removes accounts created by that import (when still owned by that import)
  - restores previous snapshots for updated accounts
  - removes username-history entries for that import

### 7) Export
- Export filtered account sets (by status and/or list).
- Formats:
  - CSV
  - TXT
  - XLSX
  - JSON
- Uses share sheet to deliver exported files.
- Includes social handles/links and processing metadata columns.

### 8) Backup & restore
- Creates full local backup JSON from app tables.
- Validates backup structure/version before restore.
- Restores transactionally by replacing current local tables.

### 9) Settings & safety controls
- Theme: system/light/dark
- Processing preferences: auto-next, confirm changes, default filter
- Instagram open behavior: prefer app + browser fallback
- Hard reset (type `RESET`) to wipe local app data

---

## Data model summary

Key persisted entities:
- `accounts`
- `account_images`
- `status_history`
- `account_username_history`
- `lists`
- `list_accounts`
- `app_imports`
- `app_import_accounts`
- `settings`

Design highlights:
- Forward migrations with schema verification.
- Indexed fields for account/status/username/search-oriented retrieval.
- Pagination-first account loading for large datasets.
- Raw imported row stored (`raw_data_json`) to preserve original data.

---

## Project structure

```text
app/                    Expo Router screens
  index.tsx             Dashboard
  import.tsx            Import flow + analysis
  queue.tsx             Sequential processing workflow
  accounts.tsx          All accounts listing
  account/[id].tsx      Account details
  lists/                List management screens
  history/              Import history + undo
  export.tsx            Export flow
  settings.tsx          Settings, backup/restore, hard reset
  statistics.tsx        Metrics overview

components/             Reusable UI parts (browser, cards, dialogs, image viewer)
services/               Parsing, import, export, backup, Instagram open, image download, settings
database/               SQLite open/migrate/repository modules + backup replacement logic
types/                  Domain types
utils/                  Normalization, formatting, hooks, constants, theme helpers
tests/                  Parser/import behavior tests
```

---

## Setup and run

Requirements:
- Node.js (project CI uses Node 22)
- Android device/emulator for runtime testing

Install and validate:

```bash
npm install
npm run typecheck
npm test
```

Run app:

```bash
npx expo start
```

Optional Android build with EAS:

```bash
npm install -g eas-cli
eas login
eas build --profile preview --platform android
```

---

## Scripts

- `npm run start` – start Expo
- `npm run android` – run Android target
- `npm run typecheck` – TypeScript no-emit check
- `npm test` – parser/import test suite

---

## Quality and validation

CI workflow (`.github/workflows/validate.yml`) runs:
1. `npm ci`
2. `npm run typecheck`
3. `npm test`

Current tests focus on import/parser correctness:
- content-based format detection
- misleading filename handling
- JSON/CSV/TSV/XLSX/JSONL/NDJSON parsing paths
- Instagram export shape recognition
- normalization and duplicate handling
- malformed input error handling

---

## Privacy and non-automation policy

- No app account system.
- No Instagram credential storage.
- No scraping or interaction automation.
- Data remains local unless user explicitly exports/shares backup or exports.
