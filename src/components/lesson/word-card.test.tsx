import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { WordCard } from '@/components/lesson/word-card';
import type { Word } from '@/content';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(),
  VoiceQuality: jest.requireActual('expo-speech/build/Speech.types').VoiceQuality,
}));

const voices = jest.mocked(Speech.getAvailableVoicesAsync);
const englishVoice = { identifier: 'en-us-1', name: 'Samantha', quality: Speech.VoiceQuality.Default, language: 'en-US' };

const myNameIs: Word = {
  id: 'everyday-a0-u1-my-name-is',
  en: 'My name is ...',
  vi: 'Tên tôi là ...',
  audio: 'My name is',
  example: { en: 'My name is Nam.', vi: 'Tên tôi là Nam.' },
};

async function renderCard(word: Word) {
  await render(<WordCard word={word} />);
  // Let the voice check settle.
  await act(() => Promise.resolve());
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Word card', () => {
  it('shows the English, its Vietnamese meaning and the example', async () => {
    voices.mockResolvedValue([]);
    await renderCard(myNameIs);

    expect(screen.getByText('My name is ...')).toBeOnTheScreen();
    expect(screen.getByText('Tên tôi là ...')).toBeOnTheScreen();
    expect(screen.getByText('My name is Nam.')).toBeOnTheScreen();
    expect(screen.getByText('Tên tôi là Nam.')).toBeOnTheScreen();
  });

  it('speaks the audio text in US English when "Nghe" is pressed', async () => {
    voices.mockResolvedValue([englishVoice]);
    await renderCard(myNameIs);

    await fireEvent.press(screen.getByRole('button', { name: 'Nghe' }));

    expect(Speech.speak).toHaveBeenCalledWith('My name is', expect.objectContaining({ language: 'en-US' }));
  });

  it('speaks the English itself when the word has no audio text', async () => {
    voices.mockResolvedValue([englishVoice]);
    await renderCard({ id: 'everyday-a0-u1-hello', en: 'Hello', vi: 'Xin chào' });

    await fireEvent.press(screen.getByRole('button', { name: 'Nghe' }));

    expect(Speech.speak).toHaveBeenCalledWith('Hello', expect.objectContaining({ language: 'en-US' }));
  });

  it('hides "Nghe" and still shows the text when the device has no English voice', async () => {
    voices.mockResolvedValue([{ ...englishVoice, language: 'vi-VN' }]);
    await renderCard(myNameIs);

    expect(screen.queryByRole('button', { name: 'Nghe' })).toBeNull();
    expect(screen.getByText('My name is ...')).toBeOnTheScreen();
  });

  it('hides "Nghe" when speech fails to report its voices', async () => {
    voices.mockRejectedValue(new Error('no speech engine'));
    await renderCard(myNameIs);

    expect(screen.queryByRole('button', { name: 'Nghe' })).toBeNull();
    expect(screen.getByText('My name is ...')).toBeOnTheScreen();
  });

  it('shows the picture of a kids word', async () => {
    voices.mockResolvedValue([]);
    await renderCard({ id: 'kids-a0-u1-cat', en: 'cat', vi: 'con mèo', picture: '🐱' });

    // Hidden from screen readers: the word itself is read out.
    expect(screen.getByText('🐱', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
