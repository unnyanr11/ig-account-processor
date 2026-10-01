export type BackupRow = Record<string, unknown>;

export interface BackupData {
  lists: BackupRow[];
  accounts: BackupRow[];
  status_history: BackupRow[];
  import_batches: BackupRow[];
  import_batch_accounts: BackupRow[];
  account_images: BackupRow[];
  list_accounts: BackupRow[];
  app_imports: BackupRow[];
  app_import_accounts: BackupRow[];
  account_username_history: BackupRow[];
}

export interface BackupFile {
  app: 'ig-account-processor';
  format: 1 | 2;
  exported_at: string;
  data: BackupData;
}
