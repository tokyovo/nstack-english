import AsyncStorage from '@react-native-async-storage/async-storage';
import { userEvent, within } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import HomeScreen from '@/app/index';
import TrackScreen from '@/app/track/[track]';
import { createProgressStore, LOCAL_PROFILE_ID } from '@/progress';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

/** The lesson player is another ticket; a stand-in screen is enough to land on. */
function LessonStandIn() {
  return <Text testID="lesson-stand-in" />;
}

/** A stack, as in the app, so a screen stays mounted under the one opened from it. */
function StackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function renderApp(initialUrl: string) {
  return renderRouter(
    {
      _layout: StackLayout,
      index: HomeScreen,
      'track/[track]': TrackScreen,
      'lesson/[unitId]': LessonStandIn,
    },
    { initialUrl }
  );
}

function completeEverydayUnit1() {
  return createProgressStore().completeLesson(LOCAL_PROFILE_ID, {
    unitId: 'everyday-a0-u1',
    correct: 10,
    total: 12,
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('Track picker (/)', () => {
  it('shows the app name, the tagline and the three tracks', async () => {
    await renderApp('/');

    expect(screen.getByRole('heading', { name: 'Học Tiếng Anh' })).toBeOnTheScreen();
    expect(screen.getByText('Học tiếng Anh từ con số không, mỗi ngày một chút.')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: /^Đời sống/ })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: /^Công việc/ })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: /^Trẻ em/ })).toBeOnTheScreen();
  });

  it('shows how many lessons of a track are completed', async () => {
    await completeEverydayUnit1();
    await renderApp('/');

    const everyday = screen.getByRole('link', { name: /^Đời sống/ });
    expect(await within(everyday).findByText(/^Đã học xong 1\/\d+ bài$/)).toBeOnTheScreen();
  });

  it('opens the track screen when a track is chosen', async () => {
    await renderApp('/');

    await userEvent.press(screen.getByRole('link', { name: /^Đời sống/ }));

    expect(screen).toHavePathname('/track/everyday');
    expect(screen.getByRole('heading', { name: 'Đời sống' })).toBeOnTheScreen();
  });
});

describe('Track screen (/track/<track>)', () => {
  it('lists the units of each level, not yet started', async () => {
    await renderApp('/track/everyday');

    expect(screen.getByRole('heading', { name: 'Đời sống' })).toBeOnTheScreen();
    expect(screen.getByRole('heading', { name: 'Bắt đầu' })).toBeOnTheScreen();
    expect(await screen.findByRole('link', { name: 'Bài 1: Chào hỏi. Chưa học' })).toBeOnTheScreen();
  });

  it('marks a completed unit as completed', async () => {
    await completeEverydayUnit1();
    await renderApp('/track/everyday');

    const unit = await screen.findByRole('link', { name: 'Bài 1: Chào hỏi. Đã học xong' });
    expect(within(unit).getByText('Đã học xong')).toBeOnTheScreen();
  });

  it('opens the lesson of a unit', async () => {
    await renderApp('/track/everyday');

    await userEvent.press(await screen.findByRole('link', { name: /^Bài 1: Chào hỏi/ }));

    expect(screen).toHavePathname('/lesson/everyday-a0-u1');
  });

  it('shows a unit as completed on coming back from its lesson', async () => {
    await renderApp('/track/everyday');
    await userEvent.press(await screen.findByRole('link', { name: 'Bài 1: Chào hỏi. Chưa học' }));

    await completeEverydayUnit1();
    await testRouter.back('/track/everyday');

    expect(await screen.findByRole('link', { name: 'Bài 1: Chào hỏi. Đã học xong' })).toBeOnTheScreen();
  });

  it('still lists the units, with a message, when progress cannot be read', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage unavailable'));
    await renderApp('/track/everyday');

    expect(
      await screen.findByText('Không đọc được tiến độ học của bạn. Bạn vẫn học được bình thường.')
    ).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Bài 1: Chào hỏi' })).toBeOnTheScreen();
  });

  it('says so for a track that does not exist, with a way back', async () => {
    await renderApp('/track/nope');

    expect(screen.getByRole('heading', { name: 'Không tìm thấy chủ đề này' })).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('link', { name: 'Về danh sách chủ đề' }));
    expect(screen).toHavePathname('/');
  });
});
