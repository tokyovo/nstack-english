// What a learner's browser session needs in more than one spec: content, buttons, axe, speech switched off.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseUnit, type Exercise, type Unit } from '../src/content/schema';

/** A unit from content/, checked by the same parser the app uses. */
export function loadUnit(path: string): Unit {
  const result = parseUnit(JSON.parse(readFileSync(join(import.meta.dirname, '..', 'content', path), 'utf8')));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.unit;
}

export function button(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

/** Answers a lesson exercise right; a speak exercise by self-check, so pair it with withoutSpeech. */
export async function answerRight(page: Page, exercise: Exercise) {
  switch (exercise.type) {
    case 'choose_meaning':
    case 'choose_english':
    case 'listen_choose':
      await button(page, exercise.answer).click();
      return;
    case 'build_sentence':
      for (const tile of exercise.answer) await button(page, tile).first().click();
      await button(page, 'Kiểm tra').click();
      return;
    case 'type_answer': {
      const input = page.getByLabel('Câu trả lời bằng tiếng Anh');
      await input.fill(exercise.answer);
      await input.press('Enter');
      return;
    }
    case 'speak':
      // withoutSpeech removes recognition, so the learner repeats aloud and marks themselves.
      await button(page, 'Tôi nói được rồi').click();
  }
}

export async function expectNoSeriousAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** Page errors and console errors from now on; the spec expects the list to stay empty. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/**
 * Headless Chromium has the Web Speech API but no working recogniser behind it. Taking it away, as in
 * a browser without recognition, makes a speak exercise run the same way every time.
 */
export async function withoutSpeechRecognition(page: Page) {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'SpeechRecognition');
    Reflect.deleteProperty(window, 'webkitSpeechRecognition');
  });
}

/** No English voice either: listening steps show the English text, as on devices with no voice. */
export async function withoutSpeech(page: Page) {
  await withoutSpeechRecognition(page);
  await page.addInitScript(() => {
    delete (window as { speechSynthesis?: unknown }).speechSynthesis;
  });
}
