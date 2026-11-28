// Speaking English aloud with the device's own text-to-speech (expo-speech; Web Speech API on web).
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

async function canSpeakEnglish(): Promise<boolean> {
  // On web the voice list can stay empty until a voiceschanged event that may never come.
  if (Platform.OS === 'web') return typeof window !== 'undefined' && 'speechSynthesis' in window;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.some((voice) => voice.language.toLowerCase().startsWith('en'));
  } catch {
    return false;
  }
}

/** False until the device is known to speak English, so "Nghe" never appears and then fails. */
export function useCanSpeak(): boolean {
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    let current = true;
    canSpeakEnglish().then((available) => {
      if (current) setCanSpeak(available);
    });
    return () => {
      current = false;
    };
  }, []);
  return canSpeak;
}

export function speakEnglish(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'en-US', rate: 0.9 });
}
