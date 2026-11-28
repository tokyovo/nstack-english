// `npm run content:manifest`: regenerates src/content/manifest.ts from content/.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readUnits } from '../src/content/files.ts';
import { manifestSource } from '../src/content/manifest-source.ts';

const root = join(import.meta.dirname, '..');
const target = join(root, 'src', 'content', 'manifest.ts');
writeFileSync(target, manifestSource(readUnits(join(root, 'content'))));
process.stdout.write(`Wrote ${target}\n`);
