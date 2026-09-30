import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { accountRepository, type AccountFilters } from '../database';
import type { AccountWithList } from '../types/account';
import { AppError } from './errors';

export class ExportError extends AppError {}

export type ExportFormat = 'csv' | 'txt' | 'xlsx';

export const EXPORT_COLUMNS = ['username', 'instagram_url', 'status', 'list', 'source', 'notes', 'created_at', 'updated_at'];

const PAGE = 1000;
const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv',
  txt: 'text/plain',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Spreadsheet apps treat cells starting with = + - @ as formulas; a leading apostrophe keeps them plain text.
function safeText(value: string | null): string {
  const v = value ?? '';
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function toRow(a: AccountWithList): string[] {
  return [a.username, a.instagram_url, a.status, safeText(a.list_name), safeText(a.source), safeText(a.notes), a.created_at, a.updated_at];
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Reads matching accounts one page at a time rather than in a single huge query. */
async function collectRows(filters: AccountFilters): Promise<string[][]> {
  const rows: string[][] = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await accountRepository.getPage(filters, PAGE, offset);
    page.forEach((account) => rows.push(toRow(account)));
    if (page.length < PAGE) break;
  }
  return rows;
}

export async function exportAccounts(filters: AccountFilters, format: ExportFormat, label: string): Promise<number> {
  try {
    const rows = await collectRows(filters);
    if (rows.length === 0) throw new ExportError('Nothing to export', 'There are no accounts to export for this selection.');

    const directory = FileSystem.cacheDirectory;
    if (!directory) throw new ExportError('No cache directory', 'The file could not be created on this device.');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const uri = `${directory}ig-accounts-${label}-${stamp}.${format}`;

    if (format === 'csv') {
      const body = [EXPORT_COLUMNS, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
      await FileSystem.writeAsStringAsync(uri, `\uFEFF${body}`);
    } else if (format === 'txt') {
      await FileSystem.writeAsStringAsync(uri, rows.map((row) => row[0]).join('\n'));
    } else {
      const sheet = XLSX.utils.aoa_to_sheet([EXPORT_COLUMNS, ...rows]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Accounts');
      const base64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    }

    if (!(await Sharing.isAvailableAsync())) {
      throw new ExportError('Sharing unavailable', 'Sharing is not available on this device, so the file could not be saved.');
    }
    await Sharing.shareAsync(uri, { mimeType: MIME[format], dialogTitle: 'Export accounts' });
    return rows.length;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new ExportError(String(error), 'The export could not be created. Please try again.');
  }
}
