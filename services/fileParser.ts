import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { SUPPORTED_IMPORT_EXTENSIONS } from '../utils/constants';
import { AppError } from './errors';
import { ExtractedEntry, extractFromLine, extractFromText } from './usernameExtractor';

export class FileParseError extends AppError {}

export interface ParsedImport {
  entries: ExtractedEntry[];
  rowCount: number;
}

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_CELLS = 3_000_000;
const HEADER_HINT = /^(user\s*name|user|handle|instagram|insta|ig|profile|link|url|account)/i;

const NO_USERNAMES =
  'No Instagram usernames were found in this file.\n\nTry uploading a file containing usernames, @usernames, or Instagram profile URLs.';
const EMPTY_FILE = 'This file is empty. Please choose a file that contains usernames.';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index).toLowerCase() : '';
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Reads a worksheet cell by cell (including hyperlink targets) with a size guard. */
function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;
  if (rowCount * colCount > MAX_CELLS) {
    throw new FileParseError('Sheet too large', 'This spreadsheet is too large to import in one go. Please split it into smaller files.');
  }
  const rows: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      const text = cell ? String(cell.w ?? cell.v ?? '') : '';
      const link = cell?.l?.Target;
      row.push(link ? `${text} ${link}` : text);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * If the first row has a username-like header (username, handle, instagram, url...),
 * only those columns are read. Otherwise every cell is scanned.
 */
function rowsToEntries(rows: string[][], into: ExtractedEntry[]): void {
  if (rows.length === 0) return;
  const columns = rows[0].map((cell, i) => (HEADER_HINT.test(cell.trim()) ? i : -1)).filter((i) => i >= 0);
  const dataRows = columns.length > 0 ? rows.slice(1) : rows;
  for (const row of dataRows) {
    const cells = columns.length > 0 ? columns.map((i) => row[i] ?? '') : row;
    for (const cell of cells) {
      for (const line of cell.split(/\r?\n/)) {
        into.push(...extractFromLine(line));
      }
    }
  }
}

function finish(entries: ExtractedEntry[], rowCount: number): ParsedImport {
  if (entries.length === 0) throw new FileParseError('No usernames found', NO_USERNAMES);
  return { entries, rowCount };
}

export async function parseImportFile(uri: string, fileName: string): Promise<ParsedImport> {
  const ext = extensionOf(fileName);
  if (!SUPPORTED_IMPORT_EXTENSIONS.includes(ext)) {
    throw new FileParseError(`Unsupported type ${ext}`, 'This file type is not supported. Please choose an XLSX, XLS, CSV or TXT file.');
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) throw new FileParseError('File missing', 'This file could not be found. Please select it again.');
    if (info.size === 0) throw new FileParseError('Empty file', EMPTY_FILE);
    if (info.size > MAX_FILE_BYTES) {
      throw new FileParseError('File too large', 'This file is very large. Please split it into smaller files (under 30 MB) and import them one at a time.');
    }
    await tick();

    if (ext === '.txt') {
      const text = stripBom(await FileSystem.readAsStringAsync(uri));
      if (!text.trim()) throw new FileParseError('Empty file', EMPTY_FILE);
      return finish(extractFromText(text), text.split(/\r?\n/).length);
    }

    const workbook =
      ext === '.csv'
        ? XLSX.read(stripBom(await FileSystem.readAsStringAsync(uri)), { type: 'string' })
        : XLSX.read(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }), { type: 'base64' });

    if (workbook.SheetNames.length === 0) throw new FileParseError('No sheets', EMPTY_FILE);

    const entries: ExtractedEntry[] = [];
    let rowCount = 0;
    for (const name of workbook.SheetNames) {
      const rows = sheetToRows(workbook.Sheets[name]);
      rowCount += rows.length;
      rowsToEntries(rows, entries);
      await tick();
    }
    return finish(entries, rowCount);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message =
      ext === '.xlsx' || ext === '.xls'
        ? 'This Excel file looks damaged or is not a valid spreadsheet. Please check the file and try again.'
        : 'This file could not be read. Please check that it is a valid text or CSV file and try again.';
    throw new FileParseError(String(error), message);
  }
}

export function parsePastedText(text: string): ParsedImport {
  if (!text.trim()) {
    throw new FileParseError('Empty paste', 'Please paste some usernames, links or text first.');
  }
  const entries = extractFromText(text);
  if (entries.length === 0) {
    throw new FileParseError('No usernames in paste', 'No Instagram usernames were found in the pasted text.\n\nTry pasting usernames, @usernames, or Instagram profile links.');
  }
  return { entries, rowCount: text.split(/\r?\n/).length };
}
