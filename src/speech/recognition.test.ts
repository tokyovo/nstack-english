import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { fakeDevice } from './__fixtures__/fake-recognition';
import { askForMicrophone, canRecognise, listenForEnglish, microphonePermission, STOP_GRACE_MS } from './recognition';

jest.mock('expo-speech-recognition', () => jest.requireActual('./__fixtures__/fake-recognition'));

beforeEach(() => {
  jest.clearAllMocks();
  fakeDevice.reset();
});

describe('canRecognise', () => {
  it('follows whether the device has a recogniser', () => {
    expect(canRecognise()).toBe(true);
    fakeDevice.available = false;
    expect(canRecognise()).toBe(false);
  });
});

describe('microphone permission', () => {
  it('reads the permission without asking for it', async () => {
    expect(await microphonePermission()).toBe('ask');
    fakeDevice.permission = 'denied';
    expect(await microphonePermission()).toBe('denied');
    fakeDevice.permission = 'granted';
    expect(await microphonePermission()).toBe('granted');
    expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks the system and reports the answer', async () => {
    expect(await askForMicrophone()).toBe(true);
    fakeDevice.reset();
    fakeDevice.answer = 'denied';
    expect(await askForMicrophone()).toBe(false);
    expect(ExpoSpeechRecognitionModule.requestPermissionsAsync).toHaveBeenCalledTimes(2);
  });
});

describe('listenForEnglish', () => {
  it('listens in US English and resolves with every transcript heard', async () => {
    const listening = listenForEnglish();
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'en-US' }));

    fakeDevice.hear('good morning', 'good mourning');

    await expect(listening.heard).resolves.toEqual({ kind: 'heard', transcripts: ['good morning', 'good mourning'] });
    expect(fakeDevice.listening()).toBe(false);
  });

  it('stops on request and keeps what was heard so far', async () => {
    const listening = listenForEnglish();
    fakeDevice.emit('result', { isFinal: true, results: [{ transcript: 'hello', confidence: 1 }] });

    listening.stop();

    await expect(listening.heard).resolves.toEqual({ kind: 'heard', transcripts: ['hello'] });
  });

  it.each([
    ['no-speech', 'nothing'],
    ['speech-timeout', 'nothing'],
    ['aborted', 'nothing'],
    ['not-allowed', 'denied'],
    ['network', 'failed'],
    ['service-not-allowed', 'failed'],
  ])('reports the recogniser error "%s" as %s', async (error, kind) => {
    const listening = listenForEnglish();

    fakeDevice.fail(error);

    await expect(listening.heard).resolves.toEqual({ kind });
  });

  it('reports nothing heard when the recogniser ends with no result', async () => {
    const listening = listenForEnglish();

    fakeDevice.emit('nomatch');
    fakeDevice.emit('end');

    await expect(listening.heard).resolves.toEqual({ kind: 'nothing' });
  });

  describe('with a recogniser that never answers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Like headless Chromium: start() and stop() are accepted and no event ever comes.
      jest.mocked(ExpoSpeechRecognitionModule.stop).mockImplementationOnce(() => undefined);
      jest.mocked(ExpoSpeechRecognitionModule.abort).mockImplementationOnce(() => undefined);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('gives up after 15 seconds of listening', async () => {
      const listening = listenForEnglish();
      let settled = false;
      listening.heard.then(() => (settled = true));

      await jest.advanceTimersByTimeAsync(14_999);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);

      await expect(listening.heard).resolves.toEqual({ kind: 'failed' });
      expect(ExpoSpeechRecognitionModule.abort).toHaveBeenCalledTimes(1);
      expect(fakeDevice.listening()).toBe(false);
    });

    it('gives up 3 seconds after the learner says they are done', async () => {
      const listening = listenForEnglish();
      await jest.advanceTimersByTimeAsync(1_000);

      listening.stop();
      await jest.advanceTimersByTimeAsync(3_000);

      await expect(listening.heard).resolves.toEqual({ kind: 'failed' });
    });
  });

  it('does nothing on stop once listening has ended', async () => {
    const listening = listenForEnglish();
    fakeDevice.hear('hello');
    await listening.heard;
    jest.mocked(ExpoSpeechRecognitionModule.stop).mockImplementationOnce(() => undefined);
    jest.useFakeTimers();

    listening.stop();
    await jest.advanceTimersByTimeAsync(STOP_GRACE_MS);

    expect(ExpoSpeechRecognitionModule.abort).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('reports a failure when the recogniser cannot start', async () => {
    jest.mocked(ExpoSpeechRecognitionModule.start).mockImplementationOnce(() => {
      throw new Error('busy');
    });

    await expect(listenForEnglish().heard).resolves.toEqual({ kind: 'failed' });
    expect(fakeDevice.listening()).toBe(false);
  });
});
