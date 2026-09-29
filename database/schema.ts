/**
 * Versioned migrations. Each entry is one schema version; PRAGMA user_version
 * records how many have been applied, so new versions are appended, never edited.
 * accounts.username is UNIQUE, which SQLite already backs with an index.
 */
export const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      instagram_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      list_id INTEGER,
      source TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      total_records INTEGER NOT NULL DEFAULT 0,
      new_records INTEGER NOT NULL DEFAULT 0,
      duplicate_records INTEGER NOT NULL DEFAULT 0,
      invalid_records INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS import_batch_accounts (
      import_batch_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      PRIMARY KEY (import_batch_id, account_id),
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_status_id ON accounts(status, id)`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_list_id ON accounts(list_id)`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_accounts_updated_at ON accounts(updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_history_account ON status_history(account_id, id)`,
    `CREATE INDEX IF NOT EXISTS idx_iba_account ON import_batch_accounts(account_id)`,
  ],
];
