import { AccountStatus, STATUS_LABELS } from '../types/account';

/** Upper-case display label for a stored status string; unknown values are shown as stored. */
export function statusLabel(value: string | null): string {
  if (!value) return 'NEW';
  const label = STATUS_LABELS[value as AccountStatus];
  return (label ?? value).toUpperCase();
}
