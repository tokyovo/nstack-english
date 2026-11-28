import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { fakeDevice } from './__fixtures__/fake-recognition';
import { askForMicrophone, canRecognise, listenForEnglish, microphonePermission } from './recognition';

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

  it('reports a failure when the recogniser cannot start', async () => {
    jest.mocked(ExpoSpeechRecognitionModule.start).mockImplementationOnce(() => {
      throw new Error('busy');
    });

    await expect(listenForEnglish().heard).resolves.toEqual({ kind: 'failed' });
    expect(fakeDevice.listening()).toBe(false);
  });
});
