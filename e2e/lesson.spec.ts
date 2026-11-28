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

/** The English being taught is marked lang="en", so screen readers pronounce it as English on a vi page. */
async function expectEnglish(page: Page, text: string) {
  await expect(page.getByText(text, { exact: true }).first()).toHaveAttribute('lang', 'en');
}

/** Checks that the English on screen is marked as English and the Vietnamese is not. */
async function expectLanguagesMarked(page: Page, exercise: Exercise) {
  switch (exercise.type) {
    case 'choose_meaning':
      await expect(page.getByText(exercise.options[0], { exact: true })).not.toHaveAttribute('lang', 'en');
      return;
    case 'choose_english':
    case 'listen_choose':
      for (const option of exercise.options) await expectEnglish(page, option);
      return;
    case 'build_sentence':
      for (const tile of exercise.tiles) await expectEnglish(page, tile);
      return;
    case 'speak':
      await expectEnglish(page, exercise.text);
      await expect(page.getByText(exercise.vi, { exact: true })).not.toHaveAttribute('lang', 'en');
      return;
    case 'type_answer':
  }
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
      return;
    }
    case 'speak':
      // Without speech recognition the learner listens, repeats aloud and marks themselves.
      await expect(page.getByText('Bấm “Nghe” để nghe câu mẫu, nói to theo, rồi tự chấm.')).toBeVisible();
      await button(page, 'Tôi nói được rồi').click();
  }
}

/** Plays the lesson up to its first speak exercise, answering everything before it right. */
async function playToSpeak(page: Page): Promise<Extract<Exercise, { type: 'speak' }>> {
  await page.goto(`/lesson/${unit.id}`);
  await button(page, 'Bắt đầu học').click();
  for (let i = 0; i < unit.words.length; i++) await button(page, 'Tiếp tục').click();
  for (const exercise of unit.exercises) {
    if (exercise.type === 'speak') return exercise;
    await answerRight(page, exercise);
    await button(page, 'Tiếp tục').click();
  }
  throw new Error(`${unit.id} has no speak exercise`);
}

/**
 * Headless Chromium has the Web Speech API but no working recogniser behind it. Taking it away, as in
 * a browser without recognition, makes a speak exercise run the same way every time.
 */
async function withoutSpeechRecognition(page: Page) {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'SpeechRecognition');
    Reflect.deleteProperty(window, 'webkitSpeechRecognition');
  });
}

test('a learner completes everyday A0 u1, reloads, and sees it completed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await withoutSpeechRecognition(page);

  await page.goto(`/lesson/${unit.id}`);
  await expect(page.getByRole('heading', { name: unit.title, level: 1 })).toBeVisible();
  await expect(page.getByText('Bạn đã học xong bài này.')).toHaveCount(0);
  await expectNoSeriousAxeViolations(page);
  await button(page, 'Bắt đầu học').click();

  for (const word of unit.words) {
    await expect(page.getByTestId('word-card')).toContainText(word.en);
    await expect(page.getByTestId('word-card').getByText(word.en, { exact: true })).toHaveAttribute('lang', 'en');
    if (word.example) await expectEnglish(page, word.example.en);
    await button(page, 'Tiếp tục').click();
  }

  const [first, ...rest] = unit.exercises;
  // The first answer is wrong on purpose: the feedback gives the right answer in Vietnamese.
  if (first.type !== 'choose_meaning') throw new Error('expected u1 to open with choose_meaning');
  await expectLanguagesMarked(page, first);
  await button(page, first.options.find((o) => o !== first.answer) ?? '').click();
  await expect(page.getByText('Chưa đúng.')).toBeVisible();
  await expect(page.getByText(`Đáp án đúng: ${first.answer}`)).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await button(page, 'Tiếp tục').click();

  for (const exercise of rest) {
    await expectLanguagesMarked(page, exercise);
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

test('a learner leaves mid-lesson for the track list and keeps the answers given', async ({ page }) => {
  await page.goto(`/lesson/${unit.id}`);
  const leave = page.getByRole('link', { name: 'Rời bài học, quay lại chủ đề Đời sống' });
  await expect(leave).toHaveText('Rời bài học');
  await button(page, 'Bắt đầu học').click();
  for (let i = 0; i < unit.words.length; i++) await button(page, 'Tiếp tục').click();
  const [first, second] = unit.exercises;
  await answerRight(page, first);
  await button(page, 'Tiếp tục').click();
  await answerRight(page, second);
  await expect(page.getByText('Đúng rồi!')).toBeVisible();

  const box = await leave.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await leave.click();

  await expect(page).toHaveURL(/\/track\/everyday$/);
  await expect(page.getByRole('heading', { name: 'Đời sống', level: 1 })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('hocenglish.progress.local'));
  const answers = (JSON.parse(saved ?? '{}') as { answers?: Record<string, unknown[]> }).answers ?? {};
  expect(Object.keys(answers).sort()).toEqual([first.id, second.id]);
});

test('a speak exercise falls back to self-check where the browser has no recogniser', async ({ page }) => {
  await withoutSpeechRecognition(page);
  const speak = await playToSpeak(page);

  await expect(page.getByText('Nói câu này bằng tiếng Anh')).toBeVisible();
  await expect(button(page, 'Nói')).toHaveCount(0);
  await expectNoSeriousAxeViolations(page);
  await button(page, 'Tôi chưa nói được').click();

  await expect(page.getByText('Chưa đúng.')).toBeVisible();
  await expect(page.getByText(`Đáp án đúng: ${speak.text}`)).toBeVisible();
});

test('with the real speech API, "Nói" explains the microphone first and falls back when it hears nothing', async ({
  page,
}) => {
  await playToSpeak(page);

  await button(page, 'Nói').click();
  await expect(page.getByText(/ứng dụng cần dùng micrô/)).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await button(page, 'Cho phép dùng micrô').click();

  // Headless Chromium has no microphone: it listens until "Nói xong", then has heard nothing.
  await expect(page.getByText('Đang nghe... Bạn hãy nói câu ở trên.')).toBeVisible();
  await button(page, 'Nói xong').click();
  await expect(page.getByText(/Chưa nghe thấy bạn nói/)).toBeVisible();
  await button(page, 'Không dùng micrô, tự chấm').click();
  await button(page, 'Tôi nói được rồi').click();
  await expect(page.getByText('Đúng rồi!')).toBeVisible();
});

test('an unknown lesson says so and links home', async ({ page }) => {
  await page.goto('/lesson/everyday-a0-u99');
  await expect(page.getByText('Không tìm thấy bài học này.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
});
