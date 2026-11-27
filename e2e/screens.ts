/**
 * Every screen of the app: the one list read by `drive screens`, `drive check`
 * and the axe e2e. A new screen adds a row here.
 */
export type Screen = { name: string; path: string };

export const screens: Screen[] = [{ name: 'welcome', path: '/' }];
