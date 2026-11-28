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
    case 'type_answer':
  }
}

/** Gives the page a browser voice list, as a browser with or without English voices has. */
async function fakeVoices(page: Page, languages: string[]) {
  await page.addInitScript((langs) => {
    const voices = langs.map((lang) => ({ lang, name: lang, voiceURI: lang, localService: true, default: false }));
    const spoken: string[] = [];
    Object.assign(window, { spoken });
    window.speechSynthesis.getVoices = () => voices as unknown as SpeechSynthesisVoice[];
    window.speechSynthesis.speak = (utterance) => void spoken.push(utterance.text);
  }, languages);
}

function spoken(page: Page) {
  return page.evaluate(() => (window as unknown as { spoken: string[] }).spoken);
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
  // A browser with no voices, like headless or Linux Chromium: the listening text is shown instead of "Nghe".
  await fakeVoices(page, []);
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
    if (exercise.type === 'listen_choose') {
      await expect(page.getByTestId('listen-text')).toHaveText(exercise.audio);
      await expect(button(page, 'Nghe')).toHaveCount(0);
    }
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

test('with an English voice, "Nghe" speaks the word and the listening item without showing its text', async ({ page }) => {
  await fakeVoices(page, ['vi-VN', 'en-US']);
  await page.goto(`/lesson/${unit.id}`);
  await button(page, 'Bắt đầu học').click();

  const [word] = unit.words;
  await button(page, 'Nghe').click();
  expect(await spoken(page)).toEqual([word.audio ?? word.en]);
  for (let i = 0; i < unit.words.length; i++) await button(page, 'Tiếp tục').click();

  const index = unit.exercises.findIndex((e) => e.type === 'listen_choose');
  const listening = unit.exercises[index];
  if (listening.type !== 'listen_choose') throw new Error('expected a listen_choose item in u1');
  for (const exercise of unit.exercises.slice(0, index)) {
    await answerRight(page, exercise);
    await button(page, 'Tiếp tục').click();
  }
  await expect(page.getByTestId('listen-text')).toHaveCount(0);
  await button(page, 'Nghe').click();
  expect((await spoken(page)).at(-1)).toBe(listening.audio);
  await answerRight(page, listening);
  await expect(page.getByText('Đúng rồi!')).toBeVisible();
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

test('an unknown lesson says so and links home', async ({ page }) => {
  await page.goto('/lesson/everyday-a0-u99');
  await expect(page.getByText('Không tìm thấy bài học này.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
});
