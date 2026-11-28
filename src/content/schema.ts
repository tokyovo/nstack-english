// The shape of a unit file in content/<track>/<level>/u<n>.json, and the parser
// that turns its JSON into a typed Unit or lists every broken rule.
// Rules that need more than one unit (word order, duplicate ids, sources) live in check.ts.

export const tracks = ['everyday', 'work', 'kids'] as const;
export type Track = (typeof tracks)[number];

/** CEFR levels; "a0" is pre-A1 (Bắt đầu). */
export const levels = ['a0', 'a1', 'a2'] as const;
export type Level = (typeof levels)[number];

export const exerciseTypes = [
  'choose_meaning',
  'choose_english',
  'listen_choose',
  'build_sentence',
  'type_answer',
  'speak',
] as const;
export type ExerciseType = (typeof exerciseTypes)[number];

export const MIN_WORDS = 6;
export const MIN_EXERCISES = 10;
export const MIN_SPEAK = 2;

export type Word = {
  id: string;
  en: string;
  vi: string;
  /** English text to speak; the app falls back to `en`. */
  audio?: string;
  example?: { en: string; vi: string };
  /** Emoji picture of the word (kids track). */
  picture?: string;
  /** Overrides the unit's source for this item. */
  source?: string;
};

/**
 * A pattern to fill in, such as "My name is ..." or "Where is the ...?": taught and recognised,
 * but not a sentence the learner can type or say as written.
 */
export function isTemplate(english: string): boolean {
  return english.includes('...') || english.includes('…');
}

type ExerciseBase = { id: string; hint_vi?: string; source?: string };

export type Exercise = ExerciseBase &
  (
    | { type: 'choose_meaning'; /** a word id */ prompt: string; options: string[]; answer: string }
    | { type: 'choose_english'; prompt: string; options: string[]; answer: string }
    | { type: 'listen_choose'; audio: string; options: string[]; answer: string }
    | {
        type: 'build_sentence';
        prompt: string;
        tiles: string[];
        answer: string[];
        /** Other correct orders of the tiles, e.g. "Lan is my name" for "My name is Lan". */
        accepted?: string[][];
        /** Why a time or place phrase at one end cannot move to the other, e.g. "in" is part of "live in". */
        fixedOrder?: string;
      }
    | { type: 'type_answer'; prompt: string; answer: string; accepted?: string[] }
    | { type: 'speak'; /** English the learner says */ text: string; vi: string }
  );

export type Unit = {
  id: string;
  track: Track;
  level: Level;
  number: number;
  title: string;
  goals: string[];
  /** Short usage or grammar note in Vietnamese; required from A1 up. */
  note_vi?: string;
  source: string;
  /** Proper names (Lan, Nam) exercises may use without teaching them. */
  names?: string[];
  words: Word[];
  exercises: Exercise[];
};

export type ParseResult = { ok: true; unit: Unit } | { ok: false; errors: string[] };

type Fields = Record<string, unknown>;

const unitKeys = ['id', 'track', 'level', 'number', 'title', 'goals', 'note_vi', 'source', 'names', 'words', 'exercises'];
const wordKeys = ['id', 'en', 'vi', 'audio', 'example', 'picture', 'source'];
const exerciseKeys: Record<ExerciseType, string[]> = {
  choose_meaning: ['prompt', 'options', 'answer'],
  choose_english: ['prompt', 'options', 'answer'],
  listen_choose: ['audio', 'options', 'answer'],
  build_sentence: ['prompt', 'tiles', 'answer', 'accepted', 'fixedOrder'],
  type_answer: ['prompt', 'answer', 'accepted'],
  speak: ['text', 'vi'],
};

/** Collects errors as "<where>: <what>" while reading untyped JSON. */
class Reader {
  readonly errors: string[] = [];

  fail(at: string, message: string) {
    this.errors.push(`${at}: ${message}`);
  }

  /** Checks for unknown keys only when `allowed` is given. */
  fields(value: unknown, at: string, allowed?: string[]): Fields {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.fail(at, 'must be an object');
      return {};
    }
    const fields: Fields = Object.fromEntries(Object.entries(value));
    for (const key of Object.keys(fields)) {
      if (allowed && !allowed.includes(key)) this.fail(`${at}.${key}`, 'unknown field');
    }
    return fields;
  }

  text(fields: Fields, key: string, at: string): string {
    const value = fields[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
    this.fail(`${at}.${key}`, 'missing or empty');
    return '';
  }

  optionalText(fields: Fields, key: string, at: string): string | undefined {
    return fields[key] === undefined ? undefined : this.text(fields, key, at);
  }

  texts(fields: Fields, key: string, at: string, size?: { min: number; max: number }): string[] {
    const value = fields[key];
    if (!Array.isArray(value)) {
      this.fail(`${at}.${key}`, 'must be a list');
      return [];
    }
    if (size && (value.length < size.min || value.length > size.max)) {
      this.fail(`${at}.${key}`, `needs ${size.min} to ${size.max} items, has ${value.length}`);
    }
    return value.map((item, i) => this.text({ [i]: item }, String(i), `${at}.${key}`));
  }

  optionalTexts(fields: Fields, key: string, at: string): string[] | undefined {
    return fields[key] === undefined ? undefined : this.texts(fields, key, at);
  }

  oneOf<T extends string>(fields: Fields, key: string, at: string, allowed: readonly T[]): T {
    const found = allowed.find((option) => option === fields[key]);
    if (found === undefined) this.fail(`${at}.${key}`, `must be one of ${allowed.join(', ')}`);
    return found ?? allowed[0];
  }

  /** With `fallback`, the field is optional and the fallback stands in when it is absent. */
  list(fields: Fields, key: string, at: string, fallback?: unknown[]): unknown[] {
    const value = fields[key];
    if (Array.isArray(value)) return value;
    if (value === undefined && fallback) return fallback;
    this.fail(`${at}.${key}`, 'must be a list');
    return [];
  }
}

function itemId(r: Reader, fields: Fields, at: string, unitId: string): string {
  const id = r.text(fields, 'id', at);
  if (id && !id.startsWith(`${unitId}-`)) r.fail(id, `id must start with "${unitId}-"`);
  return id || at;
}

function parseWord(r: Reader, value: unknown, at: string, unitId: string, track: Track): Word {
  const fields = r.fields(value, at, wordKeys);
  const id = itemId(r, fields, at, unitId);
  const word: Word = { id, en: r.text(fields, 'en', id), vi: r.text(fields, 'vi', id) };
  const audio = r.optionalText(fields, 'audio', id);
  if (audio) word.audio = audio;
  if (fields.example !== undefined) {
    const example = r.fields(fields.example, `${id}.example`, ['en', 'vi']);
    word.example = { en: r.text(example, 'en', `${id}.example`), vi: r.text(example, 'vi', `${id}.example`) };
  }
  const picture = track === 'kids' ? r.text(fields, 'picture', id) : r.optionalText(fields, 'picture', id);
  if (picture) word.picture = picture;
  const source = r.optionalText(fields, 'source', id);
  if (source) word.source = source;
  return word;
}

function checkOptions(r: Reader, id: string, options: string[], answer: string) {
  const repeated = options.find((option, i) => options.indexOf(option) !== i);
  if (repeated !== undefined) r.fail(id, `options repeat "${repeated}"`);
  if (answer && !options.includes(answer)) r.fail(id, `answer "${answer}" is not among the options`);
}

/** Returns the tiles an order leaves unused, or undefined when it uses a tile that is not there. */
function unusedTiles(r: Reader, id: string, tiles: string[], order: string[], label: string): string[] | undefined {
  const left = [...tiles];
  for (const tile of order) {
    const i = left.indexOf(tile);
    if (i === -1) {
      r.fail(id, `${label} tile "${tile}" is not among the tiles`);
      return undefined;
    }
    left.splice(i, 1);
  }
  return left;
}

function checkTiles(r: Reader, id: string, tiles: string[], answer: string[], accepted: string[][]) {
  const left = unusedTiles(r, id, tiles, answer, 'answer');
  if (left && left.length > 2) r.fail(id, `at most 2 distractor tiles, has ${left.length}`);
  accepted.forEach((order) => unusedTiles(r, id, tiles, order, 'accepted'));
}

/** Returns undefined when the type is unknown: its other fields cannot be checked. */
function parseExercise(r: Reader, value: unknown, at: string, unitId: string): Exercise | undefined {
  const raw = typeof value === 'object' && value !== null && 'type' in value ? value.type : undefined;
  const type = exerciseTypes.find((t) => t === raw);
  const fields = r.fields(value, at, type && ['id', 'type', 'hint_vi', 'source', ...exerciseKeys[type]]);
  const id = itemId(r, fields, at, unitId);
  if (!type) {
    r.oneOf(fields, 'type', id, exerciseTypes);
    return undefined;
  }
  const base: ExerciseBase = { id };
  const hint = r.optionalText(fields, 'hint_vi', id);
  if (hint) base.hint_vi = hint;
  const source = r.optionalText(fields, 'source', id);
  if (source) base.source = source;
  const choice = { min: 3, max: 4 };

  switch (type) {
    case 'choose_meaning':
    case 'choose_english': {
      const exercise = {
        ...base,
        type,
        prompt: r.text(fields, 'prompt', id),
        options: r.texts(fields, 'options', id, choice),
        answer: r.text(fields, 'answer', id),
      };
      checkOptions(r, id, exercise.options, exercise.answer);
      return exercise;
    }
    case 'listen_choose': {
      const exercise = {
        ...base,
        type: 'listen_choose' as const,
        audio: r.text(fields, 'audio', id),
        options: r.texts(fields, 'options', id, choice),
        answer: r.text(fields, 'answer', id),
      };
      checkOptions(r, id, exercise.options, exercise.answer);
      return exercise;
    }
    case 'build_sentence': {
      const accepted = r.list(fields, 'accepted', id, []).map((order, i) =>
        r.texts({ [i]: order }, String(i), `${id}.accepted`)
      );
      const fixedOrder = r.optionalText(fields, 'fixedOrder', id);
      const exercise = {
        ...base,
        type: 'build_sentence' as const,
        prompt: r.text(fields, 'prompt', id),
        tiles: r.texts(fields, 'tiles', id),
        answer: r.texts(fields, 'answer', id),
        ...(accepted.length > 0 ? { accepted } : {}),
        ...(fixedOrder ? { fixedOrder } : {}),
      };
      checkTiles(r, id, exercise.tiles, exercise.answer, accepted);
      return exercise;
    }
    case 'type_answer': {
      const accepted = r.optionalTexts(fields, 'accepted', id);
      return {
        ...base,
        type: 'type_answer',
        prompt: r.text(fields, 'prompt', id),
        answer: r.text(fields, 'answer', id),
        ...(accepted ? { accepted } : {}),
      };
    }
    case 'speak':
      return { ...base, type: 'speak', text: r.text(fields, 'text', id), vi: r.text(fields, 'vi', id) };
  }
}

/** Reads one unit file's JSON. Never throws: a broken unit comes back with every error found. */
export function parseUnit(data: unknown): ParseResult {
  const r = new Reader();
  const declaredId = typeof data === 'object' && data !== null && 'id' in data ? data.id : undefined;
  const at = typeof declaredId === 'string' && declaredId ? declaredId : 'unit';
  const fields = r.fields(data, at, unitKeys);

  const track = r.oneOf(fields, 'track', at, tracks);
  const level = r.oneOf(fields, 'level', at, levels);
  const number = fields.number;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) {
    r.fail(`${at}.number`, 'must be a whole number from 1');
  }
  const id = r.text(fields, 'id', at);
  const expectedId = `${track}-${level}-u${String(number)}`;
  if (id && id !== expectedId) r.fail(at, `id must be "${expectedId}" (track-level-u<number>)`);

  const unit: Unit = {
    id,
    track,
    level,
    number: typeof number === 'number' ? number : 0,
    title: r.text(fields, 'title', at),
    goals: r.texts(fields, 'goals', at),
    source: r.text(fields, 'source', at),
    words: r.list(fields, 'words', at).map((w, i) => parseWord(r, w, `${at}.words.${i}`, id, track)),
    exercises: [],
  };
  const exercises = r.list(fields, 'exercises', at);
  for (const [i, value] of exercises.entries()) {
    const exercise = parseExercise(r, value, `${at}.exercises.${i}`, id);
    if (exercise) unit.exercises.push(exercise);
  }
  const note = level === 'a0' ? r.optionalText(fields, 'note_vi', at) : r.text(fields, 'note_vi', at);
  if (note) unit.note_vi = note;
  const names = r.optionalTexts(fields, 'names', at);
  if (names) unit.names = names;

  if (unit.words.length < MIN_WORDS) r.fail(at, `needs at least ${MIN_WORDS} words, has ${unit.words.length}`);
  if (exercises.length < MIN_EXERCISES) {
    r.fail(at, `needs at least ${MIN_EXERCISES} exercises, has ${exercises.length}`);
  }
  const speaks = unit.exercises.filter((e) => e.type === 'speak').length;
  if (speaks < MIN_SPEAK) r.fail(at, `needs at least ${MIN_SPEAK} speak items, has ${speaks}`);

  return r.errors.length === 0 ? { ok: true, unit } : { ok: false, errors: r.errors };
}
