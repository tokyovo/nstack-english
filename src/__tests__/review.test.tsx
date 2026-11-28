import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, within } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import HomeScreen from '@/app/index';
import ReviewScreen from '@/app/review';
import { getUnit, type Exercise, type Unit, type Word } from '@/content';
import { createProgressStore, LOCAL_PROFILE_ID } from '@/progress';
import { fakeDevice } from '@/speech/__fixtures__/fake-recognition';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// No English voice: listen_choose shows the English text instead of "Nghe".
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

jest.mock('expo-speech-recognition', () => jest.requireActual('@/speech/__fixtures__/fake-recognition'));

const DAY = 24 * 60 * 60 * 1000;

function requireUnit(id: string): Unit {
  const found = getUnit(id);
  if (!found) throw new Error(`${id} is missing`);
  return found;
}

const unit = requireUnit('everyday-a0-u1');

function StackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

async function openApp(initialUrl: string) {
  await renderRouter({ _layout: StackLayout, index: HomeScreen, review: ReviewScreen }, { initialUrl });
  await act(() => Promise.resolve());
}

/** Finishes everyday A0 u1 `ago` milliseconds before now, so its words are in box 1 since then. */
function finishLessonAgo(ago: number) {
  return createProgressStore({ now: () => new Date(Date.now() - ago) }).completeLesson(LOCAL_PROFILE_ID, {
    unitId: unit.id,
    correct: 14,
    total: 14,
  });
}

async function press(name: string | RegExp) {
  await fireEvent.press(await screen.findByRole('button', { name }));
}

/** Answers the review exercise about `word` right. */
async function answerRight(word: Word, type: Exercise['type']) {
  switch (type) {
    case 'choose_meaning':
      await press(word.vi);
      return;
    case 'listen_choose':
      await press(word.en);
      return;
    case 'type_answer':
      await fireEvent.changeText(screen.getByLabelText('Câu trả lời bằng tiếng Anh'), word.en);
      await press('Kiểm tra');
      return;
    default:
      throw new Error(`review does not ask ${type}`);
  }
}

const ROTATION = ['choose_meaning', 'listen_choose', 'type_answer'] as const;

beforeEach(async () => {
  await AsyncStorage.clear();
  fakeDevice.reset();
  // Most devices here cannot hear speech, so no review step is said aloud (answerRight throws on one).
  fakeDevice.available = false;
});

describe('Review (/review)', () => {
  it('says there is nothing to review before any lesson is finished, and links home', async () => {
    await openApp('/review');

    expect(await screen.findByText('Chưa có từ cần ôn')).toBeOnTheScreen();
    expect(screen.getByText('Học xong một bài để có từ ôn tập.')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveProp('href', '/');
  });

  it('says to come back later when the learned words are not due yet', async () => {
    await finishLessonAgo(0);
    await openApp('/review');

    expect(await screen.findByText('Chưa có từ cần ôn')).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã ôn hết từ đến hạn. Hãy quay lại sau nhé.')).toBeOnTheScreen();
  });

  it('asks about every word due a day after the lesson, records each under the word id, and shows the result', async () => {
    await finishLessonAgo(DAY);
    await openApp('/review');
    const total = unit.words.length;

    for (const [i, word] of unit.words.entries()) {
      expect(await screen.findByText(`Từ ${i + 1}/${total}`)).toBeOnTheScreen();
      if (i === 0) {
        // The first is answered wrong on purpose: the feedback gives the right meaning.
        expect(screen.getByText(word.en)).toBeOnTheScreen();
        const options = screen.getAllByTestId(/^option-/);
        const wrong = options.find((option) => !within(option).queryByText(word.vi));
        if (!wrong) throw new Error('no wrong option');
        await fireEvent.press(wrong);
        expect(screen.getByText(`Đáp án đúng: ${word.vi}`)).toBeOnTheScreen();
      } else {
        await answerRight(word, ROTATION[i % 3]);
        expect(screen.getByText('Đúng rồi!')).toBeOnTheScreen();
      }
      await press('Tiếp tục');
    }

    expect(await screen.findByRole('heading', { name: 'Xong phần ôn tập!' })).toBeOnTheScreen();
    expect(screen.getByText(`Bạn nhớ đúng ${total - 1}/${total} từ.`)).toBeOnTheScreen();
    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);
    expect(progress.answers[unit.words[0].id]).toEqual([expect.objectContaining({ correct: false })]);
    expect(progress.answers[unit.words[1].id]).toEqual([expect.objectContaining({ correct: true })]);
    expect(Object.keys(progress.answers)).toHaveLength(total);
  });

  it('asks one word aloud where the device can hear speech, and records what was heard under the word id', async () => {
    fakeDevice.available = true;
    await finishLessonAgo(DAY);
    await openApp('/review');
    const spoken: string[] = [];

    for (const [i, word] of unit.words.entries()) {
      await screen.findByText(`Từ ${i + 1}/${unit.words.length}`);
      if (screen.queryByText('Nói câu này bằng tiếng Anh')) {
        expect(screen.getByText(word.en)).toBeOnTheScreen();
        expect(screen.getByText(word.vi)).toBeOnTheScreen();
        await press('Nói');
        await press('Cho phép dùng micrô');
        await screen.findByText('Đang nghe... Bạn hãy nói câu ở trên.');
        await act(() => fakeDevice.hear(word.en.toLowerCase()));
        spoken.push(word.id);
      } else {
        await answerRight(word, ROTATION[i % 3]);
      }
      expect(await screen.findByText('Đúng rồi!')).toBeOnTheScreen();
      await press('Tiếp tục');
    }

    expect(await screen.findByRole('heading', { name: 'Xong phần ôn tập!' })).toBeOnTheScreen();
    // The longest phrase of everyday A0 u1.
    expect(spoken).toEqual(['everyday-a0-u1-nice-to-meet-you']);
    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);
    expect(progress.answers[spoken[0]]).toEqual([expect.objectContaining({ correct: true })]);
  });

  it('says when the answers could not be saved, and saves them on "Thử lại"', async () => {
    await finishLessonAgo(DAY);
    await openApp('/review');
    const last = unit.words.length - 1;
    for (const [i, word] of unit.words.slice(0, last).entries()) {
      await answerRight(word, ROTATION[i % 3]);
      await press('Tiếp tục');
    }
    // The last answer fails to save, and again when the review ends.
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    await answerRight(unit.words[last], ROTATION[last % 3]);
    await press('Tiếp tục');

    expect(await screen.findByText('Chưa lưu được kết quả. Hãy thử lại.')).toBeOnTheScreen();
    expect((await createProgressStore().load(LOCAL_PROFILE_ID)).answers[unit.words[last].id]).toBeUndefined();
    await press('Thử lại');

    expect(await screen.findByRole('heading', { name: 'Xong phần ôn tập!' })).toBeOnTheScreen();
    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);
    expect(progress.answers[unit.words[last].id]).toHaveLength(1);
    expect(Object.keys(progress.answers)).toHaveLength(unit.words.length);
  });
});

describe('Review on home (/)', () => {
  it('asks to finish a lesson first when no word has been learned', async () => {
    await openApp('/');

    expect(await screen.findByText('Chưa có từ cần ôn')).toBeOnTheScreen();
    expect(screen.getByText('Học xong một bài để có từ ôn tập.')).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: /^Ôn tập/ })).toBeNull();
  });

  it('says to come back later when the learned words are not due yet', async () => {
    await finishLessonAgo(0);
    await openApp('/');

    expect(await screen.findByText('Chưa có từ cần ôn')).toBeOnTheScreen();
    expect(screen.getByText('Bạn đã ôn hết từ đến hạn. Hãy quay lại sau nhé.')).toBeOnTheScreen();
  });

  it('shows how many words are due and opens the review', async () => {
    await finishLessonAgo(DAY);
    await openApp('/');

    expect(await screen.findByText(`${unit.words.length} từ cần ôn`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Ôn tập ngay' }));

    expect(await screen.findByText(`Từ 1/${unit.words.length}`)).toBeOnTheScreen();
  });
});
