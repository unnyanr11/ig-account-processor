export function normalizeUsername(raw: string): string {
  let value = raw.trim();
  value = value.replace(/^@+/, '');
  value = value.replace(/\/+$/, '');
  value = value.split('?')[0];
  value = value.split('#')[0];
  return value.trim().toLowerCase();
}

export function buildInstagramUrl(username: string): string {
  return `https://www.instagram.com/${username}/`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDateHuman(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTimeHuman(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${formatDateHuman(iso)} ${time}`;
}
