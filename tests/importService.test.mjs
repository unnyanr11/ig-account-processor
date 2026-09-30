import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeImport } from '../services/importService.ts';
import { parseCsv, parseFile, parseJson } from '../services/fileParser.ts';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('supports QModels.json object-wrapped array and username extraction', async () => {
  const analysis = await analyzeImport(fixture('QModels.json'), 'QModels.json', async (usernames) => {
    return new Set(usernames.filter((username) => username === 'beta'));
  });

  assert.equal(analysis.total, 7);
  assert.equal(analysis.invalid, 1);
  assert.equal(analysis.duplicates, 0);
  assert.equal(analysis.existingRecords, 1);
  assert.equal(analysis.newRecords, 5);
  assert.deepEqual(analysis.validRecords.map((record) => record.username), ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']);
});

test('supports QModels-2.csv with BOM, quoted commas, duplicates and invalid usernames', async () => {
  const analysis = await analyzeImport(fixture('QModels-2.csv'), 'QModels-2.csv', async () => new Set(['beta']));

  assert.equal(analysis.total, 5);
  assert.equal(analysis.invalid, 1);
  assert.equal(analysis.duplicates, 1);
  assert.equal(analysis.existingRecords, 1);
  assert.equal(analysis.newRecords, 2);
  assert.deepEqual(analysis.validRecords.map((record) => record.username), ['alpha', 'beta', 'gamma']);
});

test('supports headerless CSV rows', () => {
  const rows = parseCsv('alpha\n@beta\nhttps://instagram.com/gamma\n');
  assert.deepEqual(rows, [
    { column_1: 'alpha' },
    { column_1: '@beta' },
    { column_1: 'https://instagram.com/gamma' },
  ]);
});

test('preserves TXT import compatibility for pasted usernames', async () => {
  const analysis = await analyzeImport('alpha\n@beta\nhttps://instagram.com/gamma', 'accounts.txt', async () => new Set());
  assert.deepEqual(analysis.validRecords.map((record) => record.username), ['alpha', 'beta', 'gamma']);
  assert.equal(analysis.invalid, 0);
});

test('reports malformed JSON with actionable error', () => {
  assert.throws(() => parseJson('{"data": ['), /Malformed JSON file/);
});

test('reports malformed CSV with actionable error', () => {
  assert.throws(() => parseCsv('username\n"unterminated'), /Malformed CSV/);
});

test('rejects unsupported extensions with actionable error', () => {
  assert.throws(() => parseFile('anything', 'accounts.xml'), /Unsupported file type/);
});
