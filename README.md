# IG Account Processor

Production-oriented Android app built with Expo, React Native, TypeScript, Expo Router and SQLite for local-first, manual Instagram account processing.

## Core rules

- Filename-independent: filename is provenance metadata only. Parser/schema selection is based on content, extension and MIME evidence.
- Data-preserving: normalized fields are optimized for search; the original imported row is retained in raw_data_json.
- Local-first: accounts, status history, imports, lists, images and settings are stored locally.
- Manual Instagram use only: the app can open a profile, but never logs in, scrapes Instagram, follows/unfollows, likes, comments, DMs, simulates taps, stores credentials, or bypasses restrictions.
- Scalable: SQLite indexes, paginated account queries, batched imports and controlled image downloads are used for large datasets.

## Import formats

Supported: JSON, JSONL, NDJSON, CSV, TSV, XLSX, XLS, TXT, XML and HTML.

The importer detects common JSON object-wrapped arrays (models, accounts, users, profiles, data, items, results, records, rows), flexible CSV headers, headerless delimited data, UTF-8 BOM, CRLF/LF, quoted cells and embedded commas.

Known mappings include model name, letter, Instagram username/link, X username/link, TikTok username/link, Babepedia source and profile image fields with common naming variants. Unknown fields remain in the original row.

Missing values such as N/A, NA, null, -, and empty strings are treated as missing where appropriate. Missing Instagram information does not discard the record.

## Identity and processing

When present, normalized Instagram username is the strongest identity signal. @handles, profile URLs and common URL formatting variants normalize to the same lowercase username. Non-profile Instagram routes such as /explore, /reels, /p, /stories, /direct and /accounts are not treated as usernames. X/TikTok profile links are normalized to their corresponding handles and retained alongside Instagram data.

Records without Instagram usernames receive a stable database ID and remain available for browsing, editing, lists, notes and export. The app never invents a username from a model name.

Processing statuses include New, Followed, Skipped, Unavailable, Already Following, Not Interested, No Instagram, Image Unavailable and Check Later. Status changes are persisted and recorded in history, with temporary undo.

## Images

Imported image URLs are preserved. The generic Babepedia advanced-search placeholder is recognized and is never bulk-downloaded as a genuine profile image.

Actual images are stored in the application filesystem, not SQLite. SQLite stores metadata and local paths. Downloads use a controlled concurrency queue and validate HTTP(S) sources. The UI prefers local images, then remote URLs, then a placeholder.

The app does not fetch or scrape Instagram pages to obtain names or images.

## Database

The database uses forward migrations and keeps legacy data intact. Modern tables include accounts, account_images, status_history, lists, list_accounts, app_imports, app_import_accounts, legacy import-history tables, and settings.

Frequently searched fields have SQLite indexes. Accounts are queried with pagination instead of loading the full dataset into React state.

## Backup, restore and hard reset

Backups contain the local database tables and metadata. Restore validates the backup structure before replacing data and performs replacement transactionally.

Hard Reset is available in Settings → Data. It requires typing RESET exactly and removes only this application's local data. It does not interact with Instagram or attempt to bypass external enforcement.

## Android setup

Requirements: Node 18+, Android device/emulator.

    npm install
    npx expo install --check
    npm run typecheck
    npm test
    npx expo start

For an EAS Android build:

    npm install -g eas-cli
    eas login
    eas build --profile preview --platform android

The app uses the Android system document picker and does not require broad storage permission.

## Validation

Tests cover filename independence, JSON/CSV schema recognition, quoted CSV/BOM/CRLF, missing Instagram values, JSONL/NDJSON/TSV, misleading extensions, malformed input, and duplicate/normalization behavior.

Before release, test on-device with 1,000 / 10,000 / 25,000 / 50,000-record datasets, image downloads, backup/restore, hard reset, dark/light/system themes, screen readers, and Instagram installed/uninstalled browser fallback.

## Privacy

The core application has no account system, analytics, cloud sync or Instagram credentials. Imported data and local images remain on the device unless the user explicitly exports or shares them.
