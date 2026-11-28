import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { ExerciseStep } from '@/components/lesson/exercise-step';
import { getUnit, type Exercise } from '@/content';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(),
  VoiceQuality: jest.requireActual('expo-speech/build/Speech.types').VoiceQuality,
}));

const voices = jest.mocked(Speech.getAvailableVoicesAsync);
const englishVoice = { identifier: 'en-us-1', name: 'Samantha', quality: Speech.VoiceQuality.Default, language: 'en-US' };

function exercise(id: string): Exercise {
  const found = getUnit('everyday-a0-u1')?.exercises.find((e) => e.id === `everyday-a0-u1-${id}`);
  if (!found) throw new Error(`no exercise ${id} in everyday A0 u1`);
  return found;
}

const onAnswer = jest.fn();
const onContinue = jest.fn();

async function renderStep(item: Exercise) {
  await render(<ExerciseStep exercise={item} onAnswer={onAnswer} onContinue={onContinue} />);
  await act(() => Promise.resolve());
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
}

beforeEach(() => {
  jest.clearAllMocks();
  voices.mockResolvedValue([englishVoice]);
});

describe('choose_meaning', () => {
  it('shows the English word and accepts its Vietnamese meaning', async () => {
    await renderStep(exercise('e01'));

    expect(screen.getByText('Hello')).toBeOnTheScreen();
    await press('Xin chào');

    expect(screen.getByText('Đúng rồi!')).toBeOnTheScreen();
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('shows the right meaning in Vietnamese feedback after a wrong choice, then continues', async () => {
    await renderStep(exercise('e01'));

    await press('Tạm biệt');

    expect(screen.getByText('Chưa đúng.')).toBeOnTheScreen();
    expect(screen.getByText('Đáp án đúng: Xin chào')).toBeOnTheScreen();
    expect(onAnswer).toHaveBeenCalledWith(false);
    await press('Tiếp tục');
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('takes only the first choice', async () => {
    await renderStep(exercise('e01'));

    await press('Tạm biệt');
    await press('Xin chào');

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});

describe('choose_english', () => {
  it('shows the Vietnamese prompt and accepts the English answer', async () => {
    await renderStep(exercise('e04'));

    expect(screen.getByText('Chào buổi sáng')).toBeOnTheScreen();
    await press('Good morning');

    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('shows the right English after a wrong choice', async () => {
    await renderStep(exercise('e04'));

    await press('Goodbye');

    expect(screen.getByText('Đáp án đúng: Good morning')).toBeOnTheScreen();
  });
});

describe('listen_choose', () => {
  it('speaks the audio on "Nghe" without showing it, and accepts what was heard', async () => {
    await renderStep(exercise('e07'));

    await press('Nghe');
    expect(Speech.speak).toHaveBeenCalledWith('How are you?', expect.objectContaining({ language: 'en-US' }));
    // The words are shown only as options, not as the prompt.
    expect(screen.getAllByText('How are you?')).toHaveLength(1);

    await press('How are you?');
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('shows the audio text instead of "Nghe" when speech is unavailable', async () => {
    voices.mockResolvedValue([]);
    await renderStep(exercise('e07'));

    expect(screen.queryByRole('button', { name: 'Nghe' })).toBeNull();
    expect(screen.getByTestId('listen-text')).toHaveTextContent('How are you?');
  });
});

describe('build_sentence', () => {
  it('builds the sentence from tiles and accepts the right order', async () => {
    await renderStep(exercise('e06'));

    expect(screen.getByText('Tên tôi là Lan.')).toBeOnTheScreen();
    for (const tile of ['My', 'name', 'is', 'Lan']) await press(tile);
    await press('Kiểm tra');

    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(screen.getByText('Đúng rồi!')).toBeOnTheScreen();
  });

  it('lets a placed tile be taken back before checking', async () => {
    await renderStep(exercise('e06'));

    await press('My');
    await press('you');
    await press('Bỏ “you”');
    for (const tile of ['name', 'is', 'Lan']) await press(tile);
    await press('Kiểm tra');

    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('shows the right sentence after a wrong order', async () => {
    await renderStep(exercise('e06'));

    for (const tile of ['name', 'My', 'is', 'Lan']) await press(tile);
    await press('Kiểm tra');

    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(screen.getByText('Đáp án đúng: My name is Lan')).toBeOnTheScreen();
  });

  it('cannot be checked before a tile is placed', async () => {
    await renderStep(exercise('e06'));

    await press('Kiểm tra');

    expect(onAnswer).not.toHaveBeenCalled();
  });
});

describe('type_answer', () => {
  it('accepts a listed variant typed in lower case, sent with the keyboard', async () => {
    await renderStep(exercise('e09'));

    expect(screen.getByText('Tạm biệt')).toBeOnTheScreen();
    const input = screen.getByLabelText('Câu trả lời bằng tiếng Anh');
    await fireEvent.changeText(input, ' bye. ');
    await fireEvent(input, 'submitEditing');

    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('shows the right answer after a wrong one and keeps what was typed', async () => {
    await renderStep(exercise('e09'));

    await fireEvent.changeText(screen.getByLabelText('Câu trả lời bằng tiếng Anh'), 'Good night');
    await press('Kiểm tra');

    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(screen.getByText('Đáp án đúng: Goodbye')).toBeOnTheScreen();
    expect(screen.getByLabelText('Câu trả lời bằng tiếng Anh')).toHaveDisplayValue('Good night');
  });

  it('cannot be checked while empty', async () => {
    await renderStep(exercise('e09'));

    await fireEvent.changeText(screen.getByLabelText('Câu trả lời bằng tiếng Anh'), '   ');
    await press('Kiểm tra');

    expect(onAnswer).not.toHaveBeenCalled();
  });
});
