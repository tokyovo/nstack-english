import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { ExerciseStep } from '@/components/lesson/exercise-step';
import { getUnit, type Exercise } from '@/content';
import { seeded } from '@/lesson/__fixtures__/seeded';
import { fakeDevice } from '@/speech/__fixtures__/fake-recognition';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  getAvailableVoicesAsync: jest.fn(),
  VoiceQuality: jest.requireActual('expo-speech/build/Speech.types').VoiceQuality,
}));

jest.mock('expo-speech-recognition', () => jest.requireActual('@/speech/__fixtures__/fake-recognition'));

const voices = jest.mocked(Speech.getAvailableVoicesAsync);
const englishVoice = { identifier: 'en-us-1', name: 'Samantha', quality: Speech.VoiceQuality.Default, language: 'en-US' };

function exercise(id: string): Exercise {
  const found = getUnit('everyday-a0-u1')?.exercises.find((e) => e.id === `everyday-a0-u1-${id}`);
  if (!found) throw new Error(`no exercise ${id} in everyday A0 u1`);
  return found;
}

const words = getUnit('everyday-a0-u1')?.words ?? [];

const onAnswer = jest.fn();
const onContinue = jest.fn();

async function renderStep(item: Exercise, random?: () => number) {
  await render(<ExerciseStep exercise={item} words={words} onAnswer={onAnswer} onContinue={onContinue} random={random} />);
  await act(() => Promise.resolve());
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeDevice.reset();
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

describe('speak', () => {
  const askSystem = ExpoSpeechRecognitionModule.requestPermissionsAsync;

  /** The learner taps "Nói", the recogniser starts, and the step is waiting for speech. */
  async function startSpeaking() {
    await press('Nói');
    expect(await screen.findByText('Đang nghe... Bạn hãy nói câu ở trên.')).toBeOnTheScreen();
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1);
  }

  async function heard(...transcripts: string[]) {
    await act(() => fakeDevice.hear(...transcripts));
  }

  it('shows the English and its meaning, and asks for the microphone only after "Nói" and the reason', async () => {
    await renderStep(exercise('e15'));

    expect(screen.getByText('Nói câu này bằng tiếng Anh')).toBeOnTheScreen();
    expect(screen.getByText("I'm fine, thank you.")).toBeOnTheScreen();
    expect(screen.getByText('Tôi khỏe, cảm ơn bạn.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nghe' })).toBeOnTheScreen();
    expect(ExpoSpeechRecognitionModule.getPermissionsAsync).not.toHaveBeenCalled();

    await press('Nói');
    expect(await screen.findByText(/ứng dụng cần dùng micrô/)).toBeOnTheScreen();
    expect(askSystem).not.toHaveBeenCalled();

    await press('Cho phép dùng micrô');
    expect(askSystem).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Đang nghe... Bạn hãy nói câu ở trên.')).toBeOnTheScreen();
    await heard('I am fine thank you');

    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(screen.getByText('Máy nghe được:')).toBeOnTheScreen();
    expect(screen.getByText('I am fine thank you')).toBeOnTheScreen();
    expect(screen.getByText('Đúng rồi!')).toBeOnTheScreen();
  });

  it('listens straight away when the microphone is already allowed', async () => {
    fakeDevice.permission = 'granted';
    await renderStep(exercise('e15'));

    await startSpeaking();

    expect(screen.queryByText(/ứng dụng cần dùng micrô/)).toBeNull();
    expect(askSystem).not.toHaveBeenCalled();
  });

  it('starts listening once and answers once when "Nói" is tapped twice quickly', async () => {
    fakeDevice.permission = 'granted';
    await renderStep(exercise('e15'));
    const speakButton = screen.getByRole('button', { name: 'Nói' });

    await act(async () => {
      fireEvent.press(speakButton);
      fireEvent.press(speakButton);
    });
    await heard('I am fine thank you');

    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('marks a phrase heard too differently as wrong and shows the right one', async () => {
    fakeDevice.permission = 'granted';
    await renderStep(exercise('e15'));
    await startSpeaking();

    await heard('good morning');

    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(screen.getByText('good morning')).toBeOnTheScreen();
    expect(screen.getByText("Đáp án đúng: I'm fine, thank you.")).toBeOnTheScreen();
  });

  it('stops listening on "Nói xong" and judges what was heard', async () => {
    fakeDevice.permission = 'granted';
    await renderStep(exercise('e15'));
    await startSpeaking();
    await act(() => fakeDevice.emit('result', { isFinal: true, results: [{ transcript: "I'm fine, thank you", confidence: 1 }] }));

    await press('Nói xong');

    expect(ExpoSpeechRecognitionModule.stop).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('lets the learner try again when nothing was heard, without counting an answer', async () => {
    fakeDevice.permission = 'granted';
    await renderStep(exercise('e15'));
    await startSpeaking();

    await act(() => fakeDevice.fail('no-speech'));

    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByText(/Chưa nghe thấy bạn nói/)).toBeOnTheScreen();
    jest.mocked(ExpoSpeechRecognitionModule.start).mockClear();
    await startSpeaking();
  });

  it('offers self-check after nothing was heard, so a silent microphone is not a dead end', async () => {
    fakeDevice.permission = 'granted';
    await renderStep(exercise('e15'));
    await startSpeaking();
    await act(() => fakeDevice.fail('no-speech'));

    await press('Không dùng micrô, tự chấm');
    await press('Tôi nói được rồi');

    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('falls back to listen, repeat and self-check when the microphone is refused', async () => {
    fakeDevice.answer = 'denied';
    await renderStep(exercise('e15'));

    await press('Nói');
    await press('Cho phép dùng micrô');

    expect(await screen.findByText(/chưa được dùng micrô/)).toBeOnTheScreen();
    expect(screen.getByText('Bấm “Nghe” để nghe câu mẫu, nói to theo, rồi tự chấm.')).toBeOnTheScreen();
    expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
    await press('Tôi nói được rồi');

    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: 'Tôi nói được rồi' })).toBeNull();
  });

  it('goes to self-check, without asking, when the microphone was refused before', async () => {
    fakeDevice.permission = 'denied';
    await renderStep(exercise('e15'));

    await press('Nói');

    expect(await screen.findByText(/chưa được dùng micrô/)).toBeOnTheScreen();
    expect(askSystem).not.toHaveBeenCalled();
  });

  it('goes to self-check when the learner would rather not use the microphone', async () => {
    await renderStep(exercise('e15'));

    await press('Nói');
    await press('Không dùng micrô, tự chấm');

    expect(askSystem).not.toHaveBeenCalled();
    await press('Tôi chưa nói được');
    expect(onAnswer).toHaveBeenCalledWith(false);
  });

  it('goes to self-check when the recogniser fails', async () => {
    fakeDevice.permission = 'granted';
    await renderStep(exercise('e15'));
    await startSpeaking();

    await act(() => fakeDevice.fail('network'));

    expect(screen.getByText(/Máy chưa nghe được giọng nói lúc này/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tôi nói được rồi' })).toBeOnTheScreen();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('offers only listen, repeat and self-check on a device without recognition', async () => {
    fakeDevice.available = false;
    await renderStep(exercise('e15'));

    expect(screen.queryByRole('button', { name: 'Nói' })).toBeNull();
    expect(screen.getByText('Bấm “Nghe” để nghe câu mẫu, nói to theo, rồi tự chấm.')).toBeOnTheScreen();
    await press('Tôi chưa nói được');

    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(screen.getByText("Đáp án đúng: I'm fine, thank you.")).toBeOnTheScreen();
    expect(screen.queryByText('Bấm “Nghe” để nghe câu mẫu, nói to theo, rồi tự chấm.')).toBeNull();
  });

  it('asks to read aloud when the device can neither recognise nor speak English', async () => {
    fakeDevice.available = false;
    voices.mockResolvedValue([]);
    await renderStep(exercise('e15'));

    expect(screen.queryByRole('button', { name: 'Nghe' })).toBeNull();
    expect(screen.getByText('Bạn hãy đọc to câu ở trên, rồi tự chấm.')).toBeOnTheScreen();
  });
});

describe('option order', () => {
  const item = exercise('e01');
  const options = item.type === 'choose_meaning' ? item.options : [];

  /** The option texts top to bottom, as the learner sees them. */
  function shownOrder() {
    return options.map((_, i) => within(screen.getByTestId(`option-${i}`)).getByText(/./).props.children as string);
  }

  it('shows the options in another order each time the item is shown, so the place gives nothing away', async () => {
    const random = seeded(1);
    const orders: string[][] = [];
    for (let showing = 0; showing < 6; showing++) {
      await renderStep(item, random);
      orders.push(shownOrder());
      await screen.unmount();
    }

    for (const order of orders) expect([...order].sort()).toEqual(['Cảm ơn', 'Tạm biệt', 'Xin chào']);
    expect(new Set(orders.map((order) => order.indexOf('Xin chào'))).size).toBeGreaterThan(1);
  });

  it('judges the tapped option by its words, wherever it is shown', async () => {
    const random = seeded(1);
    for (let showing = 0; showing < 6; showing++) {
      await renderStep(item, random);
      await fireEvent.press(screen.getByTestId(`option-${shownOrder().indexOf('Xin chào')}`));
      expect(onAnswer).toHaveBeenLastCalledWith(true);
      await screen.unmount();
    }
  });

  it('keeps the order while the item stays on screen', async () => {
    await renderStep(item, seeded(3));
    const before = shownOrder();

    await press('Tạm biệt');
    await screen.rerender(<ExerciseStep exercise={item} words={words} onAnswer={onAnswer} onContinue={onContinue} random={seeded(4)} />);

    expect(shownOrder()).toEqual(before);
  });
});
