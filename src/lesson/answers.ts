// How a learner's answer is judged, and the right answer shown when it is wrong.
import type { Exercise } from '@/content';

type TypeAnswer = Extract<Exercise, { type: 'type_answer' }>;
type BuildSentence = Extract<Exercise, { type: 'build_sentence' }>;

/** Ignores case, extra spaces, commas, final punctuation and the typographic apostrophe. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/,/g, ' ')
    .replace(/[\s.!?;:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAny(given: string, expected: string[]): boolean {
  const typed = normalise(given);
  return typed !== '' && expected.some((text) => normalise(text) === typed);
}

export function isTypedAnswerCorrect(exercise: TypeAnswer, typed: string): boolean {
  return matchesAny(typed, [exercise.answer, ...(exercise.accepted ?? [])]);
}

/** Compared as text, so "My" and "my" are the same tile in another order. */
export function isSentenceCorrect(exercise: BuildSentence, placed: string[]): boolean {
  const orders = [exercise.answer, ...(exercise.accepted ?? [])];
  return matchesAny(placed.join(' '), orders.map((order) => order.join(' ')));
}

export function rightAnswer(exercise: Exercise): string {
  switch (exercise.type) {
    case 'build_sentence':
      return exercise.answer.join(' ');
    case 'speak':
      return exercise.text;
    default:
      return exercise.answer;
  }
}
