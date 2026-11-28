// Speaking English aloud with the device's own text-to-speech (expo-speech; Web Speech API on web).
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** How long a browser may take to list its voices before the text is kept instead of "Nghe". */
const VOICE_WAIT_MS = 2000;

function isEnglish(language: string): boolean {
  return language.toLowerCase().startsWith('en');
}

async function nativeCanSpeakEnglish(): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.some((voice) => isEnglish(voice.language));
  } catch {
    return false;
  }
}

/**
 * Browsers can have speechSynthesis and no voices at all (headless or Linux Chromium), and list
 * their voices late, on voiceschanged. Waits a short while for an English one, then gives up so
 * the shown text never turns into a button mid-exercise. Returns the cleanup.
 */
function watchWebEnglishVoice(onFound: () => void): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return () => {};
  const synthesis = window.speechSynthesis;
  const hasEnglishVoice = () => synthesis.getVoices().some((voice) => isEnglish(voice.lang));
  if (hasEnglishVoice()) {
    onFound();
    return () => {};
  }

  const stop = () => {
    clearTimeout(timer);
    synthesis.removeEventListener('voiceschanged', check);
  };
  const check = () => {
    if (!hasEnglishVoice()) return;
    stop();
    onFound();
  };
  const timer = setTimeout(stop, VOICE_WAIT_MS);
  synthesis.addEventListener('voiceschanged', check);
  return stop;
}

/** False until the device is known to speak English, so "Nghe" never appears and then fails. */
export function useCanSpeak(): boolean {
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return watchWebEnglishVoice(() => setCanSpeak(true));
    let current = true;
    nativeCanSpeakEnglish().then((available) => {
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
