// A stand-in for the expo-speech-recognition native module in Jest, which has no microphone.
// Use with: jest.mock('expo-speech-recognition', () => jest.requireActual('@/speech/__fixtures__/fake-recognition'));
type Listener = (event: unknown) => void;
type Status = 'granted' | 'denied' | 'undetermined';

const listeners = new Map<string, Set<Listener>>();

function permission(status: Status) {
  return { status, granted: status === 'granted', canAskAgain: status === 'undetermined', expires: 'never' };
}

/** What the fake device does; tests change it, then `reset()` in beforeEach. */
export const fakeDevice = {
  available: true,
  permission: 'undetermined' as Status,
  /** The learner's answer to the system permission dialog. */
  answer: 'granted' as Status,
  reset() {
    this.available = true;
    this.permission = 'undetermined';
    this.answer = 'granted';
    listeners.clear();
  },
  emit(name: string, event: unknown = {}) {
    for (const listener of [...(listeners.get(name) ?? [])]) listener(event);
  },
  /** The recogniser hears `transcripts` and ends, as after the learner stops talking. */
  hear(...transcripts: string[]) {
    this.emit('result', { isFinal: true, results: transcripts.map((transcript) => ({ transcript, confidence: 0.9 })) });
    this.emit('end');
  },
  fail(error: string) {
    this.emit('error', { error, message: error });
    this.emit('end');
  },
  listening() {
    return (listeners.get('end')?.size ?? 0) > 0;
  },
};

export const ExpoSpeechRecognitionModule = {
  isRecognitionAvailable: () => fakeDevice.available,
  getPermissionsAsync: jest.fn(() => Promise.resolve(permission(fakeDevice.permission))),
  requestPermissionsAsync: jest.fn(() => {
    fakeDevice.permission = fakeDevice.answer;
    return Promise.resolve(permission(fakeDevice.answer));
  }),
  start: jest.fn(),
  stop: jest.fn(() => fakeDevice.emit('end')),
  abort: jest.fn(() => fakeDevice.fail('aborted')),
  addListener(name: string, listener: Listener) {
    const set = listeners.get(name) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(name, set);
    return { remove: () => set.delete(listener) };
  },
};
