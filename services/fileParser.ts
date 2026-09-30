import * as XLSX from 'xlsx';

export type ParsedRow = Record<string, unknown>;

function normalizeJsonRows(value: unknown): ParsedRow[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is ParsedRow => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['accounts', 'users', 'profiles', 'data', 'items', 'results']) {
      if (key in record) {
        const rows = normalizeJsonRows(record[key]);
        if (rows.length) return rows;
      }
    }
    return [record];
  }

  return [];
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

export function parseCsv(content: string): ParsedRow[] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((header, index) => header || `column_${index + 1}`);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<ParsedRow>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

export function parseJson(content: string): ParsedRow[] {
  return normalizeJsonRows(JSON.parse(content));
}

export function parseFile(content: string, fileName: string): ParsedRow[] {
  const extension = fileName.toLowerCase().split('.').pop();

  if (extension === 'json') return parseJson(content);
  if (extension === 'csv') return parseCsv(content);

  const workbook = XLSX.read(content, { type: 'string' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ParsedRow>(firstSheet, { defval: '' });
}
