// What a child profile may hold, for the app and the server (server/profiles.ts imports it by path):
// a nickname and one of a fixed set of animal pictures, never an upload or a photo.
export const PROFILE_PICTURES = ['🐱', '🐶', '🐰', '🐻', '🐼', '🦊', '🐯', '🐨'] as const;

export type ProfilePicture = (typeof PROFILE_PICTURES)[number];

/** Children an account may have, besides the parent's own profile. */
export const MAX_CHILDREN = 4;

/** Longest nickname, in characters. */
export const MAX_NICKNAME = 20;

export function isProfilePicture(value: unknown): value is ProfilePicture {
  return PROFILE_PICTURES.some((picture) => picture === value);
}
