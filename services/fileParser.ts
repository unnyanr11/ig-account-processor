import * as XLSX from 'xlsx';

export type ParsedRow = Record<string, unknown>;

const SUPPORTED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'json', 'txt'] as const;

function normalizeText(content: string): string {
  return content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function normalizeJsonRows(value: unknown): ParsedRow[] {
  if (Array.isArray(value)) {
    const rows: ParsedRow[] = [];
    for (const item of value) {
      if (item && typeof item === 'object' && !Array.isArray(item)) rows.push(item as ParsedRow);
      else if (typeof item === 'string' || typeof item === 'number') rows.push({ username: String(item) });
    }
    return rows;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['accounts', 'users', 'profiles', 'data', 'items', 'results']) {
      if (key in record) {
        const rows = normalizeJsonRows(record[key]);
        if (rows.length) return rows;
      }
    }
    for (const nested of Object.values(record)) {
      const rows = normalizeJsonRows(nested);
      if (rows.length) return rows;
    }
    return [record];
  }

  return [];
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  const pushValue = () => {
    row.push(value);
    value = '';
  };

  const pushRow = () => {
    pushValue();
    const trimmed = row.map((cell) => cell.trim());
    if (trimmed.some((cell) => cell.length > 0)) rows.push(trimmed);
    row = [];
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      if (value.trim().length > 0) throw new Error('Malformed CSV: unexpected quote in unquoted field.');
      quoted = true;
      value = '';
      continue;
    }

    if (character === ',') {
      pushValue();
      continue;
    }

    if (character === '\n') {
      pushRow();
      continue;
    }

    value += character;
  }

  if (quoted) throw new Error('Malformed CSV: missing closing quote.');
  if (value.length > 0 || row.length > 0) pushRow();
  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function hasHeaderRow(firstRow: string[]): boolean {
  const headerKeys = new Set(['username', 'usernames', 'user', 'handle', 'url', 'link', 'profileurl', 'profile', 'name', 'fullname', 'displayname']);
  return firstRow.some((cell) => headerKeys.has(normalizeHeader(cell)));
}

export function parseCsv(content: string): ParsedRow[] {
  const rows = parseCsvRows(normalizeText(content));
  if (!rows.length) return [];

  const headerMode = hasHeaderRow(rows[0]);
  const headers = headerMode
    ? rows[0].map((header, index) => header || `column_${index + 1}`)
    : Array.from({ length: Math.max(...rows.map((row) => row.length)) }, (_, index) => `column_${index + 1}`);
  const dataRows = headerMode ? rows.slice(1) : rows;

  return dataRows.map((values) => {
    return values.reduce<ParsedRow>((row, value, index) => {
      const header = headers[index] || `column_${index + 1}`;
      row[header] = value ?? '';
      return row;
    }, {});
  });
}

function parseText(content: string): ParsedRow[] {
  return normalizeText(content)
    .split('\n')
    .flatMap((line) => line.split(/[,\s]+/))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((username) => ({ username }));
}

export function parseJson(content: string): ParsedRow[] {
  try {
    return normalizeJsonRows(JSON.parse(normalizeText(content)));
  } catch {
    throw new Error('Malformed JSON file. Please check the file format and try again.');
  }
}

export function parseFile(content: string, fileName: string): ParsedRow[] {
  const extension = fileName.toLowerCase().split('.').pop() || '';

  if (extension === 'json') return parseJson(content);
  if (extension === 'csv') return parseCsv(content);
  if (extension === 'txt' || !extension) return parseText(content);
  if (extension !== 'xlsx' && extension !== 'xls') {
    throw new Error(`Unsupported file type "${extension ? `.${extension}` : fileName}". Supported types: ${SUPPORTED_EXTENSIONS.map((item) => `.${item}`).join(', ')}.`);
  }

  try {
    const workbook = XLSX.read(content, { type: 'string' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<ParsedRow>(firstSheet, { defval: '' });
  } catch {
    throw new Error('Unable to parse spreadsheet file. Please verify the file is a valid Excel document.');
  }
}
