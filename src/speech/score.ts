// Judges what a speech recogniser heard against the English the learner was asked to say.
// Forgiving on purpose (research need 5): case, punctuation, contractions and digits do not
// count, counting run together ("123") is split, and one misheard word in five still passes.

/** Share of words that must line up for a pass. */
export const PASS_SIMILARITY = 0.8;

const contractions: [RegExp, string][] = [
  [/\bcan't\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\bcannot\b/g, 'can not'],
  [/n't\b/g, ' not'],
  [/'m\b/g, ' am'],
  [/'re\b/g, ' are'],
  [/'s\b/g, ' is'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/'d\b/g, ' would'],
];

const numbers = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

/**
 * The numbers counted when a recogniser runs counting together into one number ("123" for
 * "one, two, three", "8910" for "eight, nine, ten"); the number itself when it is not a counting run.
 */
function counted(digits: string): string[] {
  if (Number(digits) < numbers.length) return [digits];
  for (let firstLength = 1; firstLength < digits.length; firstLength++) {
    const run = [Number(digits.slice(0, firstLength))];
    while (run.join('').length < digits.length) run.push(run[run.length - 1] + 1);
    if (run.join('') === digits) return run.map(String);
  }
  return [digits];
}

/** The words of a phrase as they would be said: lowercase, contractions expanded, 0-20 spelled out. */
export function spokenWords(text: string): string[] {
  let spoken = text.toLowerCase().replace(/’/g, "'");
  for (const [pattern, full] of contractions) spoken = spoken.replace(pattern, full);
  const words = (spoken.match(/[a-z]+|\d+/g) ?? []).flatMap((word) => (/^\d+$/.test(word) ? counted(word) : [word]));
  return words.map((word) => numbers[Number(word)] ?? word);
}

/** Word-level edit distance (insertions, deletions, substitutions). */
function editDistance(a: string[], b: string[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

/** 1 when the spoken words are the same, 0 when none line up. */
export function similarity(expected: string, heard: string): number {
  const want = spokenWords(expected);
  const got = spokenWords(heard);
  const longest = Math.max(want.length, got.length);
  return longest === 0 ? 0 : 1 - editDistance(want, got) / longest;
}

/**
 * Picks the recogniser's transcript closest to the expected phrase (it offers alternatives),
 * and whether that one is close enough to pass.
 */
export function judgeSpeech(expected: string, transcripts: readonly string[]): { heard: string; passed: boolean } {
  let heard = '';
  let best = 0;
  for (const transcript of transcripts) {
    const score = similarity(expected, transcript);
    if (heard === '' || score > best) {
      heard = transcript;
      best = score;
    }
  }
  return { heard, passed: best >= PASS_SIMILARITY };
}
