# IG Account Processor

An Android app (React Native, Expo, TypeScript) for working through a long list of Instagram accounts by hand. Import usernames from Excel, CSV or TXT files, keep them in a local SQLite database, and step through them one at a time: open the profile, act in Instagram yourself, come back and record the result.

**What the app never does:** follow, unfollow, like, comment or message; scrape Instagram; log in; ask for a password; store cookies or tokens; tap inside Instagram. The only Instagram interaction is opening a profile link.

## Status

The code was written and reviewed but **has not yet been installed, type-checked or run on a device** (it was authored in an environment without a device or a package registry). Expect to fix a few compile or runtime issues on the first run. Work through the testing checklist below, and use `npm run typecheck` first.

## Features

- Import from XLSX, XLS, CSV, TXT, or pasted text, with a preview before anything is saved
- Username extraction from plain names, @names and instagram.com links (profile links only; /p/, /reels/, /explore/, /stories/, /direct/, /accounts/ are ignored)
- Duplicate detection inside a file and against the database; usernames are stored lowercase and are unique
- Import history, with the accounts linked to each imported file (including ones that already existed)
- Processing queue: one account at a time, five status buttons, auto-next, undo, previous and next, and processing modes (unprocessed only, all, or one status)
- Search over username, notes and source; status filters plus Imported Today, Updated Today and Never Processed
- Lists (create, rename, delete, move accounts), notes, and a full status history per account
- Statistics that keep imported and processed counts separate, with per-list numbers
- Export to CSV, TXT or XLSX; backup and restore as a JSON file
- Light, dark and system themes; large touch targets; screen-reader labels; status is shown with a symbol and text as well as color

## Project structure

```
app/            Expo Router screens (dashboard, import, queue, accounts, account/[id],
                lists, history, statistics, export, settings)
components/     Reusable UI (AccountBrowser, AccountCard, StatusButton, dialogs, ...)
database/       SQLite only: schema and migrations, connection, repositories, backup dump/restore
services/       File parsing, username extraction, import, export, backup, Instagram opening, settings
utils/          Constants, normalization, validation, theme, hooks
types/          Shared TypeScript types
```

Screens call repositories (`database/index.ts`), never SQL. The interfaces in `database/interfaces.ts` are the seam for a later Supabase sync: wrap the SQLite repositories, write locally first, and queue remote writes. Nothing in the app talks to a server today.

## Setup

Requirements: Node 18+, an Android phone or emulator.

```
npm install
npx expo install --check
npm run typecheck
npx expo start
```

`expo install --check` aligns package versions with the installed Expo SDK. Add `icon.png`, `splash.png` and adaptive icon images under `assets/` and reference them in `app.json` before a store release.

## Building for Android with EAS

```
npm install -g eas-cli
eas login
eas build --profile development --platform android
npx expo start --dev-client
```

- `development`: a development-client APK for daily work
- `preview`: an installable APK for testing (`eas build --profile preview --platform android`)
- `production`: an app bundle for Google Play

The first `eas build` will offer to set up credentials.

## Permissions

The app declares none.

- Files are chosen with the Android system picker, which grants access to the chosen file only, so no storage permission is needed.
- Exports and backups go through the system share sheet.
- Opening Instagram or a browser uses a normal link intent.
- Optional profile metadata enrichment may fetch the public Instagram profile page for username/full-name/avatar data (no login, no credentials, no password storage). Cached avatar files are stored locally for offline rendering.

## How opening a profile works

1. If Prefer Instagram app is on, the app opens `instagram://user?username=NAME`. Android hands this to Instagram when it is installed and rejects it otherwise.
2. If that fails and Browser fallback is on (or the app is not preferred), the app opens `https://www.instagram.com/NAME/`. Android sends it to Instagram if that app handles the link, or to the browser.
3. If neither can be opened, a friendly message is shown.

The app does not log in, read the page, or interact with Instagram. When you return, you pick the status yourself.

## Data model

`accounts` (unique lowercase `username`, optional `display_name`/`full_name`, optional remote `image_url` and cached local `profile_image_uri`, `status`, `list_id`, `source`, `notes`, timestamps), `lists`, `status_history` (every status change, including undo), `import_batches` and `import_batch_accounts` (which accounts appeared in which import). Migrations are versioned with `PRAGMA user_version` in `database/schema.ts`; add new schema versions by appending, never by editing old ones. Indexes cover status, list, created and updated times, and history lookups.

## Backup and restore

Backup writes one JSON file containing every table. Restore validates the whole file first (structure, types, allowed statuses, username format, uniqueness and every cross-reference) and only then replaces the data in a single transaction. Any failure rolls back and leaves the current data unchanged. A restore always asks for confirmation.

## Testing checklist

- Empty file, file with no usernames, corrupt XLSX, unsupported extension, a very large file
- 10, 1,000, 10,000 and 25,000+ accounts: import speed, scrolling, search, queue navigation
- Import the same file twice, then a second file that overlaps the first; check the counts in the preview and in Import History
- Invalid usernames (double dots, over 30 characters, non-ASCII)
- Status change, undo, auto-next on and off, all three processing modes, previous and next
- Restart the app and confirm nothing is lost
- Export each format and open it in a spreadsheet app
- Backup, add data, restore, confirm the earlier state; try restoring a hand-edited or truncated file
- Instagram installed and not installed, with browser fallback on and off
- Dark mode and a screen reader pass

## Known limitations

- Spreadsheets are parsed on the JavaScript thread, so a very large XLSX (tens of MB) can make the app stutter while it reads. Files over 30 MB are refused with a message.
- An account shown in the app lists only its first source file; the full set of imports is in Import History.
- Search is a substring scan, not a full-text index. Measure it before relying on it at 50,000 accounts.
- Some installed dependencies may be unnecessary (for example the reanimated and gesture-handler packages); trim them once the app runs.
- Restoring replaces data; the app keeps no automatic backups.

## Privacy

Everything is stored in a local SQLite database on the device. The app has no accounts, analytics or network calls of its own.
