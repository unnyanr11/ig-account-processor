export interface BackupList {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface BackupAccount {
  id: number;
  username: string;
  instagram_url: string;
  display_name: string | null;
  full_name: string | null;
  image_url: string | null;
  profile_image_uri: string | null;
  status: string;
  list_id: number | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackupHistory {
  id: number;
  account_id: number;
  old_status: string | null;
  new_status: string;
  created_at: string;
}

export interface BackupBatch {
  id: number;
  file_name: string;
  total_records: number;
  new_records: number;
  duplicate_records: number;
  invalid_records: number;
  created_at: string;
}

export interface BackupLink {
  import_batch_id: number;
  account_id: number;
}

export interface BackupData {
  lists: BackupList[];
  accounts: BackupAccount[];
  status_history: BackupHistory[];
  import_batches: BackupBatch[];
  import_batch_accounts: BackupLink[];
}

export interface BackupFile {
  app: 'ig-account-processor';
  format: 1;
  exported_at: string;
  data: BackupData;
}
