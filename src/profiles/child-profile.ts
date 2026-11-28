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

/** Control characters and the marks that reorder text (U+061C, U+200E-F, U+202A-E, U+2066-9). */
const HIDDEN = /[\p{Cc}؜‎‏‪-‮⁦-⁩]/gu;
const INVISIBLE = /[\p{Cf}\s]/gu;

/**
 * The nickname to store: NFC, without control or direction-override characters, trimmed, at most
 * MAX_NICKNAME characters and at least one visible one; undefined when it is not one.
 */
export function readNickname(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const nickname = value.normalize('NFC').replace(HIDDEN, '').trim();
  const visible = nickname.replace(INVISIBLE, '') !== '';
  return visible && [...nickname].length <= MAX_NICKNAME ? nickname : undefined;
}
