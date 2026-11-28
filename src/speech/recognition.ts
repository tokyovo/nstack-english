// Hearing the learner speak English, through the device's own recogniser (expo-speech-recognition:
// iOS Speech, Android SpeechRecognizer, the Web Speech API in browsers). Callers never see the
// package: they get plain results, and a device without recognition simply answers "no".
import { Platform } from 'react-native';

type RecognitionModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

export type Hearing =
  | { kind: 'heard'; transcripts: string[] }
  /** Silence, or the recogniser could not make out any words. */
  | { kind: 'nothing' }
  /** The microphone or recognition permission was refused. */
  | { kind: 'denied' }
  /** No recogniser, no network for it, or it broke. */
  | { kind: 'failed' };

export type MicrophonePermission = 'granted' | 'ask' | 'denied';

let cached: RecognitionModule | null | undefined;

/** The native module, or null where it is not built in (Expo Go, Jest) instead of a crash on import. */
function recogniser(): RecognitionModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const loaded: typeof import('expo-speech-recognition') = require('expo-speech-recognition');
      cached = loaded.ExpoSpeechRecognitionModule;
    } catch {
      cached = null;
    }
  }
  return cached;
}

export function canRecognise(): boolean {
  try {
    return recogniser()?.isRecognitionAvailable() ?? false;
  } catch {
    return false;
  }
}

/** Browsers ask on first use and have no "ask now" call; read their answer when they tell it. */
async function browserMicrophonePermission(): Promise<MicrophonePermission> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'ask';
  } catch {
    return 'ask';
  }
}

/** Reads the permission without showing any dialog. */
export async function microphonePermission(): Promise<MicrophonePermission> {
  if (Platform.OS === 'web') return browserMicrophonePermission();
  const module = recogniser();
  if (!module) return 'denied';
  const response = await module.getPermissionsAsync();
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'ask' : 'denied';
}

/** Shows the system dialog. On web the browser shows its own when listening starts. */
export async function askForMicrophone(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const module = recogniser();
  if (!module) return false;
  return (await module.requestPermissionsAsync()).granted;
}

function hearingOfError(error: string): Hearing {
  if (error === 'not-allowed') return { kind: 'denied' };
  if (error === 'no-speech' || error === 'speech-timeout' || error === 'aborted') return { kind: 'nothing' };
  return { kind: 'failed' };
}

/** Listens once, until the learner stops talking or `stop()` is called. */
export function listenForEnglish(): { heard: Promise<Hearing>; stop: () => void } {
  const module = recogniser();
  if (!module) return { heard: Promise.resolve({ kind: 'failed' }), stop: () => undefined };

  const heard = new Promise<Hearing>((resolve) => {
    let transcripts: string[] = [];
    let error: Hearing | undefined;
    const subscriptions = [
      module.addListener('result', (event) => {
        if (event.isFinal) transcripts = event.results.map((result) => result.transcript);
      }),
      module.addListener('error', (event) => {
        error = hearingOfError(event.error);
      }),
      module.addListener('end', () => finish()),
    ];

    function finish(failure?: Hearing) {
      subscriptions.forEach((subscription) => subscription.remove());
      if (transcripts.length > 0) resolve({ kind: 'heard', transcripts });
      else resolve(failure ?? error ?? { kind: 'nothing' });
    }

    try {
      module.start({
        lang: 'en-US',
        interimResults: false,
        maxAlternatives: 3,
        continuous: false,
        // Short phrases: these models wait less for "more" speech (package README).
        iosTaskHint: 'confirmation',
        androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
      });
    } catch {
      finish({ kind: 'failed' });
    }
  });

  return { heard, stop: () => module.stop() };
}
