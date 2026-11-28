// The pictures a child profile may have: animal emoji only, never an upload or a photo.
// One list for the app and the server (server/profiles.ts imports it by path).
export const PROFILE_PICTURES = ['🐱', '🐶', '🐰', '🐻', '🐼', '🦊', '🐯', '🐨'] as const;

export type ProfilePicture = (typeof PROFILE_PICTURES)[number];

export function isProfilePicture(value: unknown): value is ProfilePicture {
  return PROFILE_PICTURES.some((picture) => picture === value);
}
