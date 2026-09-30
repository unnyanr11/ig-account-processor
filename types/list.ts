export interface List {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ListWithStats extends List {
  total: number;
  processed: number;
  new_count: number;
}
