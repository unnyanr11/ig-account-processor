export enum AccountStatus {
  NEW = 'NEW',
  FOLLOWED = 'FOLLOWED',
  SKIPPED = 'SKIPPED',
  UNAVAILABLE = 'UNAVAILABLE',
  ALREADY_FOLLOWING = 'ALREADY_FOLLOWING',
  NOT_INTERESTED = 'NOT_INTERESTED',
}

// Add a new status here and in the three maps below; nothing else needs to change.
export const ACCOUNT_STATUSES: AccountStatus[] = Object.values(AccountStatus);

export const STATUS_LABELS: Record<AccountStatus, string> = {
  [AccountStatus.NEW]: 'New',
  [AccountStatus.FOLLOWED]: 'Followed',
  [AccountStatus.SKIPPED]: 'Skipped',
  [AccountStatus.UNAVAILABLE]: 'Unavailable',
  [AccountStatus.ALREADY_FOLLOWING]: 'Already Following',
  [AccountStatus.NOT_INTERESTED]: 'Not Interested',
};

export const STATUS_COLORS: Record<AccountStatus, string> = {
  [AccountStatus.NEW]: '#5B8DEF',
  [AccountStatus.FOLLOWED]: '#2FB170',
  [AccountStatus.SKIPPED]: '#C9A227',
  [AccountStatus.UNAVAILABLE]: '#8A8F98',
  [AccountStatus.ALREADY_FOLLOWING]: '#8E5BEF',
  [AccountStatus.NOT_INTERESTED]: '#E15554',
};

// Symbols keep status readable without relying on color alone.
export const STATUS_SYMBOLS: Record<AccountStatus, string> = {
  [AccountStatus.NEW]: '●',
  [AccountStatus.FOLLOWED]: '✓',
  [AccountStatus.SKIPPED]: '»',
  [AccountStatus.UNAVAILABLE]: '⊘',
  [AccountStatus.ALREADY_FOLLOWING]: '✔✔',
  [AccountStatus.NOT_INTERESTED]: '✕',
};

export interface Account {
  id: number;
  username: string;
  instagram_url: string;
  status: AccountStatus;
  list_id: number | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountWithList extends Account {
  list_name: string | null;
}

export type ProcessingMode = 'UNPROCESSED_ONLY' | 'ALL' | 'SELECTED_STATUS';
