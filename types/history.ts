export interface StatusHistoryEntry {
  id: number;
  account_id: number;
  old_status: string | null;
  new_status: string;
  created_at: string;
}

export interface ImportBatch {
  id: number;
  file_name: string;
  total_records: number;
  new_records: number;
  duplicate_records: number;
  invalid_records: number;
  created_at: string;
}
