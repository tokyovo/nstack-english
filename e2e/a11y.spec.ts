import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { screens } from './screens.ts';

const BLOCKING = new Set(['serious', 'critical']);

for (const screen of screens) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${screen.name} (${screen.path}, ${colorScheme}) has no serious or critical axe violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(screen.path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const blocking = results.violations
        .filter((v) => BLOCKING.has(v.impact ?? ''))
        .map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(' ')) }));

      expect(blocking).toEqual([]);
    });
  }
}
