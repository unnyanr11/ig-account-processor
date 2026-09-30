import { parseFile, type ParsedRow } from './fileParser';

export type ImportSummary = {
  names: string[];
  total: number;
};

export function parseImportFile(content: string, fileName: string): ParsedRow[] {
  return parseFile(content, fileName);
}
