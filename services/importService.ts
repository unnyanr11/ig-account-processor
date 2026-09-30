import { parseFile, type ParsedRow } from './fileParser';

export function parseImportFile(content: string, fileName: string): ParsedRow[] {
  return parseFile(content, fileName);
}
