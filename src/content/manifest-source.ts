// Writes the source of src/content/manifest.ts: imports of the free unit files, which the app
// bundles, and a summary of every unit. Premium unit bodies stay out of the app.
import { catalogOf } from './access.ts';
import type { Unit } from './schema.ts';

/** "everyday-a0-u1" -> "everydayA0U1" */
function importName(id: string): string {
  return id.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
}

export function manifestSource(units: readonly Unit[]): string {
  const catalog = catalogOf(units);
  const free = catalog.filter((unit) => unit.access === 'free');
  return [
    '// Generated from content/ by `npm run content:manifest`. Do not edit: the manifest test fails',
    '// when it disagrees with content/. Only free units are bundled; premium bodies come from the server.',
    "import type { UnitSummary } from './access';",
    '',
    ...free.map(
      (unit) => `import ${importName(unit.id)} from '../../content/${unit.track}/${unit.level}/u${unit.number}.json';`
    ),
    '',
    `export const bundledFiles: unknown[] = [${free.map((unit) => importName(unit.id)).join(', ')}];`,
    '',
    'export const catalog: readonly UnitSummary[] = [',
    ...catalog.map((unit) => `  ${JSON.stringify(unit)},`),
    '];',
    '',
  ].join('\n');
}
