// The parent's child profiles: add, change and delete them, and read each profile's progress
// summary. Calls go out with the parent's account token (server/profiles.ts, server/progress.ts).
import { accountToken } from '@/account';
import { callApi, type ApiReply } from '@/api/client';
import { bundledUnits, tracks, unitsOf } from '@/content';
import { isLessonCompleted } from '@/progress';
import { parseProgress } from '@/progress/schema';
import type { ProfilePicture } from '@/profiles/child-profile';
import { dueWords } from '@/review/schedule';

/** Everything a child profile holds: a nickname and a picture, nothing else. */
export type ChildInput = { name: string; picture: ProfilePicture };

export type ProfileField = 'name' | 'picture';

const errorCodes = [
  'invalid_name',
  'invalid_picture',
  'too_many_children',
  'not_found',
  'signed_out',
  'offline',
  'unknown',
] as const;
export type ProfileErrorCode = (typeof errorCodes)[number];

/** `field` names the input that caused the error; without it the error is about the whole form. */
export type ProfileError = { code: ProfileErrorCode; field?: ProfileField };

export type ProfileResult = { ok: true } | { ok: false; error: ProfileError };

export type ProgressSummary = { lessonsCompleted: number; wordsDue: number };

const fieldOf: Partial<Record<ProfileErrorCode, ProfileField>> = {
  invalid_name: 'name',
  invalid_picture: 'picture',
};

export function addChild(input: ChildInput): Promise<ProfileResult> {
  return change('/api/profiles', 'POST', input);
}

export function updateChild(profileId: string, input: ChildInput): Promise<ProfileResult> {
  return change(profilePath(profileId), 'PATCH', input);
}

/** Deletes the child's profile and, on the server, all of its progress. */
export function deleteChild(profileId: string): Promise<ProfileResult> {
  return change(profilePath(profileId), 'DELETE');
}

/** Lessons finished and words due at `now`; undefined when the progress cannot be read now. */
export async function loadProgressSummary(profileId: string, now: Date): Promise<ProgressSummary | undefined> {
  const token = await accountToken();
  if (!token) return undefined;
  const reply = await callApi(`${profilePath(profileId)}/progress`, { token });
  const progress = reply.status === 200 ? parseProgress(reply.body, profileId) : null;
  if (!progress) return undefined;
  return {
    lessonsCompleted: tracks.flatMap(unitsOf).filter((unit) => isLessonCompleted(progress, unit.id)).length,
    wordsDue: dueWords(progress, bundledUnits, now).length,
  };
}

function profilePath(profileId: string): `/api/${string}` {
  return `/api/profiles/${encodeURIComponent(profileId)}`;
}

async function change(path: `/api/${string}`, method: 'POST' | 'PATCH' | 'DELETE', input?: ChildInput) {
  if (input && input.name.trim() === '') return failure('invalid_name');
  const token = await accountToken();
  if (!token) return failure('signed_out');
  const reply = await callApi(path, { method, body: input, token });
  if (reply.status === 200 || reply.status === 201 || reply.status === 204) return { ok: true } as const;
  return failure(codeOf(reply));
}

function codeOf(reply: ApiReply): ProfileErrorCode {
  if (reply.status === 'offline') return 'offline';
  if (reply.status === 401) return 'signed_out';
  const reported = typeof reply.body === 'object' && reply.body !== null && 'error' in reply.body ? reply.body.error : undefined;
  return errorCodes.find((known) => known === reported) ?? 'unknown';
}

function failure(code: ProfileErrorCode): ProfileResult {
  const field = fieldOf[code];
  return { ok: false, error: field ? { code, field } : { code } };
}
