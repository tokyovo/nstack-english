// A learner finishes a lesson, comes back a day later, reviews the due words and sees the count drop.
// The browser's clock is set by Playwright (`page.clock`), so the app needs no test-only switch.
import { expect, test, type Page } from '@playwright/test';

import { isTemplate, type Exercise } from '../src/content/schema';
import { button, collectErrors, expectNoSeriousAxeViolations, loadUnit, withoutSpeech } from './learner.ts';

const unit = loadUnit('everyday/a0/u1.json');
const START = new Date('2026-11-27T08:00:00+07:00');
const DAY = 24 * 60 * 60 * 1000;

async function answerLessonExercise(page: Page, exercise: Exercise) {
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
    case 'type_answer':
      await page.getByLabel('Câu trả lời bằng tiếng Anh').fill(exercise.answer);
      await button(page, 'Kiểm tra').click();
      return;
    case 'speak':
      // Recognition is removed below, so the learner repeats aloud and marks themselves.
      await button(page, 'Tôi nói được rồi').click();
  }
}

async function finishLesson(page: Page) {
  await page.goto(`/lesson/${unit.id}`);
  await button(page, 'Bắt đầu học').click();
  for (let i = 0; i < unit.words.length; i++) await button(page, 'Tiếp tục').click();
  for (const exercise of unit.exercises) {
    await answerLessonExercise(page, exercise);
    await button(page, 'Tiếp tục').click();
  }
  await expect(page.getByRole('heading', { name: 'Xong bài học!' })).toBeVisible();
}

/** Reads the review exercise on screen and answers it right, using the unit's words. */
async function answerReviewStep(page: Page) {
  const instruction = await page.getByRole('heading', { level: 2 }).first().innerText();
  if (instruction === 'Chọn nghĩa đúng') {
    const en = await page.locator('[lang="en"]').first().innerText();
    const word = unit.words.find((w) => w.en === en);
    await button(page, word?.vi ?? `no word "${en}"`).click();
  } else if (instruction === 'Chọn câu giống với câu này') {
    const en = await page.getByTestId('listen-text').innerText();
    await button(page, en).click();
  } else if (instruction === 'Viết bằng tiếng Anh') {
    // Only complete words: a template ("My name is ...") is never asked to be typed.
    let typed = 'no complete word shown';
    for (const word of unit.words.filter((w) => !isTemplate(w.en))) {
      if (await page.getByText(word.vi, { exact: true }).isVisible()) typed = word.en;
    }
    await page.getByLabel('Câu trả lời bằng tiếng Anh').fill(typed);
    await page.getByLabel('Câu trả lời bằng tiếng Anh').press('Enter');
  } else {
    throw new Error(`unexpected review step "${instruction}"`);
  }
}

test('a learner reviews the words of a lesson a day later and sees the due count drop', async ({ page }) => {
  const errors = collectErrors(page);
  await withoutSpeech(page);
  await page.clock.install({ time: START });

  await page.goto('/');
  const panel = page.getByTestId('review-panel');
  await expect(panel).toContainText('Chưa có từ cần ôn');
  await expect(panel).toContainText('Học xong một bài để có từ ôn tập.');

  await finishLesson(page);
  await page.goto('/');
  await expect(panel).toContainText('Bạn đã ôn hết từ đến hạn. Hãy quay lại sau nhé.');

  await page.clock.setSystemTime(new Date(START.getTime() + DAY));
  await page.reload();
  const total = unit.words.length;
  await expect(page.getByTestId('due-count')).toHaveText(`${total} từ cần ôn`);
  await page.getByRole('link', { name: 'Ôn tập ngay' }).click();

  await expect(page).toHaveURL(/\/review$/);
  for (let i = 1; i <= total; i++) {
    await expect(page.getByText(`Từ ${i}/${total}`)).toBeVisible();
    if (i === 1) await expectNoSeriousAxeViolations(page);
    await answerReviewStep(page);
    await expect(page.getByText('Đúng rồi!')).toBeVisible();
    await button(page, 'Tiếp tục').click();
  }

  await expect(page.getByRole('heading', { name: 'Xong phần ôn tập!' })).toBeVisible();
  await expect(page.getByText(`Bạn nhớ đúng ${total}/${total} từ.`)).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.getByRole('link', { name: 'Về trang chủ', exact: true }).click();
  // The home screen opened before the review stays mounted, hidden, under this one.
  await expect(page.getByText('Bạn đã ôn hết từ đến hạn. Hãy quay lại sau nhé.')).toBeVisible();
  await expect(page.getByTestId('due-count').filter({ visible: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
