// A learner completes everyday A0 u1 on web, reloads, and sees it completed.
// Runs against the served web export (`npx expo export --platform web`); baseURL comes from the config.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseUnit, type Exercise, type Unit } from '../src/content/schema';

function loadUnit(path: string): Unit {
  const result = parseUnit(JSON.parse(readFileSync(join(import.meta.dirname, '..', 'content', path), 'utf8')));
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.unit;
}

const unit = loadUnit('everyday/a0/u1.json');

function button(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

async function expectNoSeriousAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** Answers right with the keyboard where the exercise allows it, so touch and keys are both used. */
async function answerRight(page: Page, exercise: Exercise) {
  switch (exercise.type) {
    case 'choose_meaning':
    case 'choose_english':
    case 'listen_choose': {
      const option = button(page, exercise.answer);
      await option.focus();
      await page.keyboard.press('Enter');
      return;
    }
    case 'build_sentence':
      for (const tile of exercise.answer) await button(page, tile).first().click();
      await button(page, 'Kiểm tra').click();
      return;
    case 'type_answer': {
      const input = page.getByLabel('Câu trả lời bằng tiếng Anh');
      await input.fill(` ${exercise.answer.toLowerCase()}. `);
      await input.press('Enter');
    }
  }
}

test('a learner completes everyday A0 u1, reloads, and sees it completed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`/lesson/${unit.id}`);
  await expect(page.getByRole('heading', { name: unit.title, level: 1 })).toBeVisible();
  await expect(page.getByText('Bạn đã học xong bài này.')).toHaveCount(0);
  await expectNoSeriousAxeViolations(page);
  await button(page, 'Bắt đầu học').click();

  for (const word of unit.words) {
    await expect(page.getByTestId('word-card')).toContainText(word.en);
    await button(page, 'Tiếp tục').click();
  }

  const [first, ...rest] = unit.exercises;
  // The first answer is wrong on purpose: the feedback gives the right answer in Vietnamese.
  if (first.type !== 'choose_meaning') throw new Error('expected u1 to open with choose_meaning');
  await button(page, first.options.find((o) => o !== first.answer) ?? '').click();
  await expect(page.getByText('Chưa đúng.')).toBeVisible();
  await expect(page.getByText(`Đáp án đúng: ${first.answer}`)).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await button(page, 'Tiếp tục').click();

  for (const exercise of rest) {
    await answerRight(page, exercise);
    await expect(page.getByText('Đúng rồi!')).toBeVisible();
    await button(page, 'Tiếp tục').click();
  }

  const total = unit.exercises.length;
  await expect(page.getByRole('heading', { name: 'Xong bài học!' })).toBeVisible();
  await expect(page.getByText(`Bạn trả lời đúng ${total - 1}/${total} câu.`)).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.reload();
  await expect(page.getByText('Bạn đã học xong bài này.')).toBeVisible();
  await expect(button(page, 'Học lại')).toBeVisible();
  expect(errors).toEqual([]);
});

test('an unknown lesson says so and links home', async ({ page }) => {
  await page.goto('/lesson/everyday-a0-u99');
  await expect(page.getByText('Không tìm thấy bài học này.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
});
