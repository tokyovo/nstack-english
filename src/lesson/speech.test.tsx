import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useCanSpeak } from '@/lesson/speech';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

/** A browser's speechSynthesis whose voice list can change later, as Chromium's does. */
class FakeSynthesis extends EventTarget {
  voices: { lang: string }[] = [];
  getVoices() {
    return this.voices;
  }
  arrive(voices: { lang: string }[]) {
    this.voices = voices;
    this.dispatchEvent(new Event('voiceschanged'));
  }
}

let synthesis: FakeSynthesis;

beforeEach(() => {
  jest.useFakeTimers();
  jest.replaceProperty(Platform, 'OS', 'web');
  synthesis = new FakeSynthesis();
  Object.defineProperty(window, 'speechSynthesis', { value: synthesis, configurable: true });
});

afterEach(() => {
  jest.useRealTimers();
  Reflect.deleteProperty(window, 'speechSynthesis');
});

async function renderCanSpeak() {
  const hook = await renderHook(() => useCanSpeak());
  await act(() => Promise.resolve());
  return hook;
}

describe('useCanSpeak on web', () => {
  it('is false when the browser has speechSynthesis but no voices', async () => {
    const { result } = await renderCanSpeak();
    await act(() => jest.advanceTimersByTimeAsync(10_000));

    expect(result.current).toBe(false);
  });

  it('is true when an English voice is listed', async () => {
    synthesis.voices = [{ lang: 'vi-VN' }, { lang: 'en-GB' }];
    const { result } = await renderCanSpeak();

    expect(result.current).toBe(true);
  });

  it('is false when only non-English voices are listed', async () => {
    synthesis.voices = [{ lang: 'vi-VN' }];
    const { result } = await renderCanSpeak();
    await act(() => jest.advanceTimersByTimeAsync(10_000));

    expect(result.current).toBe(false);
  });

  it('turns true when an English voice arrives shortly after the first render', async () => {
    const { result } = await renderCanSpeak();
    expect(result.current).toBe(false);

    await act(() => {
      jest.advanceTimersByTime(500);
      synthesis.arrive([{ lang: 'en-US' }]);
    });

    expect(result.current).toBe(true);
  });

  it('stays false when voices arrive after it stopped waiting, so the shown text does not vanish', async () => {
    const { result } = await renderCanSpeak();
    await act(() => jest.advanceTimersByTimeAsync(10_000));

    await act(() => synthesis.arrive([{ lang: 'en-US' }]));

    expect(result.current).toBe(false);
  });

  it('is false when the browser has no speechSynthesis', async () => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    const { result } = await renderCanSpeak();

    expect(result.current).toBe(false);
  });
});
