import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter, screen as routerScreen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import LessonScreen from '@/app/lesson/[unitId]';
import { getUnit, type Exercise } from '@/content';
import { createProgressStore, isLessonCompleted, LOCAL_PROFILE_ID } from '@/progress';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

const unit = getUnit('everyday-a0-u1');
if (!unit) throw new Error('everyday-a0-u1 is missing');

/** The track list is another screen; a stand-in is enough to land on. */
function TrackStandIn() {
  return <Text testID="track-stand-in" />;
}

async function openLesson(unitId = 'everyday-a0-u1') {
  await renderRouter(
    { 'lesson/[unitId]': LessonScreen, 'track/[track]': TrackStandIn },
    { initialUrl: `/lesson/${unitId}` }
  );
  await act(() => Promise.resolve());
}

async function press(name: string | RegExp) {
  await fireEvent.press(await screen.findByRole('button', { name }));
}

/** Answers an exercise right, or wrong when `right` is false. */
async function answer(exercise: Exercise, right: boolean) {
  switch (exercise.type) {
    case 'choose_meaning':
    case 'choose_english':
    case 'listen_choose':
      await press(right ? exercise.answer : (exercise.options.find((o) => o !== exercise.answer) ?? ''));
      return;
    case 'build_sentence': {
      const order = right ? exercise.answer : [...exercise.answer].reverse();
      for (const [i, tile] of order.entries()) {
        // A tile already placed is named "Bỏ “…”", so the bank tile is the one named by its word.
        await fireEvent.press(screen.getAllByRole('button', { name: tile })[0]);
        expect(screen.getAllByRole('button', { name: /^Bỏ / })).toHaveLength(i + 1);
      }
      await press('Kiểm tra');
      return;
    }
    case 'type_answer':
      await fireEvent.changeText(screen.getByLabelText('Câu trả lời bằng tiếng Anh'), right ? exercise.answer : 'xyz');
      await press('Kiểm tra');
  }
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Lesson screen', () => {
  it('opens on the unit title, its goals and the Vietnamese usage note', async () => {
    await openLesson();

    expect(await screen.findByRole('heading', { name: 'Chào hỏi' })).toBeOnTheScreen();
    expect(screen.getByText('Có thể nói tên mình')).toBeOnTheScreen();
    expect(screen.getByText(unit.note_vi ?? '')).toBeOnTheScreen();
    expect(screen.queryByText('Bạn đã học xong bài này.')).toBeNull();
  });

  it('plays every word card, then every exercise, then shows the score and saves the lesson', async () => {
    await openLesson();
    await press('Bắt đầu học');

    for (const word of unit.words) {
      expect(screen.getByTestId('word-card')).toHaveTextContent(word.en, { exact: false });
      await press('Tiếp tục');
    }
    for (const [i, exercise] of unit.exercises.entries()) {
      await answer(exercise, i !== 0);
      await press('Tiếp tục');
    }

    const total = unit.exercises.length;
    expect(await screen.findByRole('heading', { name: 'Xong bài học!' })).toBeOnTheScreen();
    expect(screen.getByText(`Bạn trả lời đúng ${total - 1}/${total} câu.`)).toBeOnTheScreen();

    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);
    expect(progress.lessons['everyday-a0-u1']).toMatchObject({ bestCorrect: total - 1, total, timesCompleted: 1 });
    expect(progress.answers['everyday-a0-u1-e01']).toEqual([expect.objectContaining({ correct: false })]);
    expect(progress.answers['everyday-a0-u1-e02']).toEqual([expect.objectContaining({ correct: true })]);
  });

  it('shows a completed lesson as done when it is opened again', async () => {
    await createProgressStore().completeLesson(LOCAL_PROFILE_ID, { unitId: 'everyday-a0-u1', correct: 14, total: 14 });

    await openLesson();

    expect(await screen.findByText('Bạn đã học xong bài này.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Học lại' })).toBeOnTheScreen();
  });

  it('says when the result could not be saved, and saves it on "Thử lại"', async () => {
    await openLesson();
    await press('Bắt đầu học');
    for (let i = 0; i < unit.words.length; i++) await press('Tiếp tục');
    for (const exercise of unit.exercises.slice(0, -1)) {
      await answer(exercise, true);
      await press('Tiếp tục');
    }
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
    await answer(unit.exercises[unit.exercises.length - 1], true);
    await press('Tiếp tục');

    expect(await screen.findByText('Chưa lưu được kết quả. Hãy thử lại.')).toBeOnTheScreen();
    let progress = await createProgressStore().load(LOCAL_PROFILE_ID);
    expect(isLessonCompleted(progress, 'everyday-a0-u1')).toBe(false);

    await press('Thử lại');

    expect(await screen.findByRole('heading', { name: 'Xong bài học!' })).toBeOnTheScreen();
    progress = await createProgressStore().load(LOCAL_PROFILE_ID);
    expect(isLessonCompleted(progress, 'everyday-a0-u1')).toBe(true);
    expect(progress.answers['everyday-a0-u1-e14']).toHaveLength(1);
  });

  it('offers the track list when the unit is the last one of its track', async () => {
    await openLesson();
    await press('Bắt đầu học');
    for (let i = 0; i < unit.words.length; i++) await press('Tiếp tục');
    for (const exercise of unit.exercises) {
      await answer(exercise, true);
      await press('Tiếp tục');
    }

    expect(await screen.findByRole('link', { name: 'Về danh sách bài' })).toHaveProp('href', '/track/everyday');
  });

  it('offers a way to leave on the intro, every step and the result', async () => {
    await openLesson();
    const leave = () => screen.getByRole('link', { name: 'Rời bài học, quay lại chủ đề Đời sống' });

    expect(leave()).toHaveProp('href', '/track/everyday');
    expect(leave()).toHaveTextContent('Rời bài học');
    await press('Bắt đầu học');
    for (let i = 0; i < unit.words.length; i++) {
      expect(leave()).toBeOnTheScreen();
      await press('Tiếp tục');
    }
    for (const exercise of unit.exercises) {
      expect(leave()).toBeOnTheScreen();
      await answer(exercise, true);
      await press('Tiếp tục');
    }
    expect(await screen.findByRole('heading', { name: 'Xong bài học!' })).toBeOnTheScreen();
    expect(leave()).toBeOnTheScreen();
  });

  it('keeps the answers already given when the learner leaves mid-lesson', async () => {
    await openLesson();
    await press('Bắt đầu học');
    for (let i = 0; i < unit.words.length; i++) await press('Tiếp tục');
    const [first, second] = unit.exercises;
    await answer(first, false);
    await press('Tiếp tục');
    await answer(second, true);

    await fireEvent.press(screen.getByRole('link', { name: 'Rời bài học, quay lại chủ đề Đời sống' }));

    expect(routerScreen).toHavePathname('/track/everyday');
    expect(await screen.findByTestId('track-stand-in')).toBeOnTheScreen();
    const progress = await createProgressStore().load(LOCAL_PROFILE_ID);
    expect(progress.answers['everyday-a0-u1-e01']).toEqual([expect.objectContaining({ correct: false })]);
    expect(progress.answers['everyday-a0-u1-e02']).toEqual([expect.objectContaining({ correct: true })]);
    expect(isLessonCompleted(progress, 'everyday-a0-u1')).toBe(false);
  });

  it('says so when the lesson does not exist', async () => {
    await openLesson('everyday-a0-u99');

    expect(await screen.findByText('Không tìm thấy bài học này.')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toBeOnTheScreen();
  });
});
