/**
 * Every screen of the app: the one list read by `drive screens`, `drive check`
 * and the axe e2e. A new screen adds a row here.
 */
export type Screen = { name: string; path: string };

export const screens: Screen[] = [
  { name: 'home', path: '/' },
  { name: 'track', path: '/track/everyday' },
  { name: 'track-kids', path: '/track/kids' },
  { name: 'track-not-found', path: '/track/nope' },
  { name: 'lesson', path: '/lesson/everyday-a0-u1' },
  { name: 'lesson-not-found', path: '/lesson/nope' },
];
