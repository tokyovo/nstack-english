// Where the session lives: the device keychain (expo-secure-store) on iOS and Android,
// localStorage on web (the browser has no keychain a web app can use).
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'hocenglish.session';

export async function readSession(): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(KEY);
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    // A keychain entry that cannot be decrypted (e.g. restored from a backup) is no session.
    return null;
  }
}

export async function writeSession(value: string): Promise<void> {
  if (Platform.OS === 'web') localStorage.setItem(KEY, value);
  else await SecureStore.setItemAsync(KEY, value);
}

export async function deleteSession(): Promise<void> {
  if (Platform.OS === 'web') localStorage.removeItem(KEY);
  else await SecureStore.deleteItemAsync(KEY);
}
