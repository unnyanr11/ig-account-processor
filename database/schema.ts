/** Forward-compatible local-first SQLite schema. Legacy tables are preserved; v2+ adds the richer model/import/image architecture. */
export const MIGRATIONS:string[][]=[[
`CREATE TABLE IF NOT EXISTS lists (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE,instagram_url TEXT,display_name TEXT,image_url TEXT,status TEXT NOT NULL DEFAULT 'NEW',list_id INTEGER,source TEXT,notes TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(list_id) REFERENCES lists(id) ON DELETE SET NULL)`,
`CREATE TABLE IF NOT EXISTS status_history (id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER NOT NULL,old_status TEXT,new_status TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS import_batches (id INTEGER PRIMARY KEY AUTOINCREMENT,file_name TEXT NOT NULL,total_records INTEGER NOT NULL DEFAULT 0,new_records INTEGER NOT NULL DEFAULT 0,duplicate_records INTEGER NOT NULL DEFAULT 0,invalid_records INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS import_batch_accounts (import_batch_id INTEGER NOT NULL,account_id INTEGER NOT NULL,PRIMARY KEY(import_batch_id,account_id),FOREIGN KEY(import_batch_id) REFERENCES import_batches(id) ON DELETE CASCADE,FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE)`,
]];
export const POST_MIGRATIONS:{version:number;sql:string[]}[]=[
{version:4,sql:[
`ALTER TABLE accounts ADD COLUMN model_name TEXT`,`ALTER TABLE accounts ADD COLUMN letter TEXT`,`ALTER TABLE accounts ADD COLUMN profile_image_url TEXT`,`ALTER TABLE accounts ADD COLUMN local_image_path TEXT`,`ALTER TABLE accounts ADD COLUMN source_url TEXT`,`ALTER TABLE accounts ADD COLUMN source_file_name TEXT`,`ALTER TABLE accounts ADD COLUMN source_file_type TEXT`,`ALTER TABLE accounts ADD COLUMN source_mime_type TEXT`,`ALTER TABLE accounts ADD COLUMN source_row INTEGER`,`ALTER TABLE accounts ADD COLUMN source_import_id INTEGER`,`ALTER TABLE accounts ADD COLUMN raw_data_json TEXT`,`ALTER TABLE accounts ADD COLUMN last_processed_at TEXT`,`CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username)`,`CREATE INDEX IF NOT EXISTS idx_accounts_model_name ON accounts(model_name)`,`CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status)`,`CREATE INDEX IF NOT EXISTS idx_accounts_letter ON accounts(letter)`,`CREATE INDEX IF NOT EXISTS idx_accounts_created ON accounts(created_at)`,`CREATE INDEX IF NOT EXISTS idx_accounts_updated ON accounts(updated_at)`,`CREATE INDEX IF NOT EXISTS idx_accounts_source_import ON accounts(source_import_id)`
]},
{version:5,sql:[
`CREATE TABLE IF NOT EXISTS account_images(id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER NOT NULL,remote_url TEXT,local_path TEXT,is_primary INTEGER NOT NULL DEFAULT 0,image_type TEXT,download_status TEXT NOT NULL DEFAULT 'NOT_DOWNLOADED',mime_type TEXT,file_size INTEGER,width INTEGER,height INTEGER,downloaded_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE)`,
`CREATE INDEX IF NOT EXISTS idx_images_account ON account_images(account_id)`
]},
{version:6,sql:[
`CREATE TABLE IF NOT EXISTS app_imports(id INTEGER PRIMARY KEY AUTOINCREMENT,source_file_name TEXT NOT NULL,source_file_type TEXT NOT NULL,source_mime_type TEXT,source_size INTEGER,imported_at TEXT NOT NULL,total_records INTEGER NOT NULL DEFAULT 0,new_records INTEGER NOT NULL DEFAULT 0,updated_records INTEGER NOT NULL DEFAULT 0,duplicates INTEGER NOT NULL DEFAULT 0,records_without_instagram INTEGER NOT NULL DEFAULT 0,records_with_instagram INTEGER NOT NULL DEFAULT 0,records_with_images INTEGER NOT NULL DEFAULT 0,records_without_images INTEGER NOT NULL DEFAULT 0,placeholder_images INTEGER NOT NULL DEFAULT 0,warning_count INTEGER NOT NULL DEFAULT 0,error_count INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS app_import_accounts(import_id INTEGER NOT NULL,account_id INTEGER NOT NULL,source_row INTEGER,PRIMARY KEY(import_id,account_id),FOREIGN KEY(import_id) REFERENCES app_imports(id) ON DELETE CASCADE,FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS list_accounts(list_id INTEGER NOT NULL,account_id INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(list_id,account_id),FOREIGN KEY(list_id) REFERENCES lists(id) ON DELETE CASCADE,FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE)`,
`CREATE INDEX IF NOT EXISTS idx_list_accounts_list ON list_accounts(list_id)`,`CREATE INDEX IF NOT EXISTS idx_list_accounts_account ON list_accounts(account_id)`
]},
{version:7,sql:[`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)`]},
{version:8,sql:[`ALTER TABLE accounts ADD COLUMN full_name TEXT`,`ALTER TABLE accounts ADD COLUMN profile_image_uri TEXT`]},
{version:9,sql:[`CREATE TABLE IF NOT EXISTS account_username_history(id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER NOT NULL,old_username TEXT NOT NULL,new_username TEXT NOT NULL,import_id INTEGER,changed_at TEXT NOT NULL,FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE)`,`CREATE INDEX IF NOT EXISTS idx_username_history_account ON account_username_history(account_id)`,`CREATE INDEX IF NOT EXISTS idx_username_history_old ON account_username_history(old_username)`]},
{version:10,sql:[
`ALTER TABLE accounts ADD COLUMN x_username TEXT`,`ALTER TABLE accounts ADD COLUMN x_url TEXT`,`ALTER TABLE accounts ADD COLUMN identity_key TEXT`,`CREATE INDEX IF NOT EXISTS idx_accounts_x_username ON accounts(x_username)`,`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_identity_key ON accounts(identity_key)`
]},
{version:11,sql:[
`ALTER TABLE accounts ADD COLUMN tiktok_username TEXT`,`ALTER TABLE accounts ADD COLUMN tiktok_url TEXT`,`CREATE INDEX IF NOT EXISTS idx_accounts_tiktok_username ON accounts(tiktok_username)`
]}
];
export const REQUIRED_ACCOUNT_COLUMNS = [
  'username','instagram_url','x_username','x_url','tiktok_username','tiktok_url','identity_key','model_name','letter','display_name','full_name',
  'profile_image_url','image_url','profile_image_uri','local_image_path',
  'source_url','source_file_name','source_file_type','source_mime_type',
  'source_row','source_import_id','raw_data_json','last_processed_at',
  'status','list_id','source','notes','created_at','updated_at'
] as const;
