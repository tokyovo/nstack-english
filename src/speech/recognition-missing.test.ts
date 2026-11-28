// No mock here: Jest has no native ExpoSpeechRecognition module, like Expo Go or a build without it.
import { askForMicrophone, canRecognise, listenForEnglish, microphonePermission } from './recognition';

it('answers "no recognition" where the native module is missing, without throwing', async () => {
  expect(canRecognise()).toBe(false);
  expect(await microphonePermission()).toBe('denied');
  expect(await askForMicrophone()).toBe(false);
  await expect(listenForEnglish().heard).resolves.toEqual({ kind: 'failed' });
});
