// Reads unit files from content/ on disk: for Node (server, manifest script, tests), never the app.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseUnit, type Unit } from './schema.ts';

/** Every .json file under `dir`, at any depth. */
export function unitFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return unitFiles(path);
    return entry.name.endsWith('.json') ? [path] : [];
  });
}

/** Every unit in `contentDir`; throws, naming each broken file, when one does not follow the schema. */
export function readUnits(contentDir: string): Unit[] {
  const errors: string[] = [];
  const units = unitFiles(contentDir).flatMap((path) => {
    const result = parseUnit(JSON.parse(readFileSync(path, 'utf8')));
    if (result.ok) return [result.unit];
    errors.push(`${path}:\n${result.errors.join('\n')}`);
    return [];
  });
  if (errors.length > 0) throw new Error(`Invalid content units:\n${errors.join('\n')}`);
  return units;
}
