// Rules that span all units: unique ids, listed sources, that every English word an exercise or
// example shows was taught in its unit or an earlier one, and that nothing asks for a template.
import { isTemplate, levels, type Exercise, type Unit, type Word } from './schema';

/** Lowercased English words of a text; apostrophes kept ("i'm"), punctuation and digits dropped. */
export function englishTokens(text: string): string[] {
  return text.toLowerCase().replace(/’/g, "'").match(/[a-z]+(?:'[a-z]+)*/g) ?? [];
}

/** Units of one track in teaching order: by level, then unit number. */
export function inTeachingOrder(units: readonly Unit[]): Unit[] {
  return [...units].sort(
    (a, b) => levels.indexOf(a.level) - levels.indexOf(b.level) || a.number - b.number
  );
}

/** English the learner sees in an exercise. Accepted typing variants are not shown, so not checked. */
function shownEnglish(exercise: Exercise): string[] {
  switch (exercise.type) {
    case 'choose_meaning':
      return [];
    case 'choose_english':
      return exercise.options;
    case 'listen_choose':
      return [exercise.audio, ...exercise.options];
    case 'build_sentence':
      return exercise.tiles;
    case 'type_answer':
      return [exercise.answer];
    case 'speak':
      return [exercise.text];
  }
}

/** English the learner must type or say, which a template such as "My name is ..." cannot be. */
function producedEnglish(exercise: Exercise): string[] {
  switch (exercise.type) {
    case 'type_answer':
      return [exercise.answer, ...(exercise.accepted ?? [])];
    case 'speak':
      return [exercise.text];
    default:
      return [];
  }
}

function templatesAsked(units: readonly Unit[]): string[] {
  return units.flatMap((u) =>
    u.exercises.flatMap((exercise) =>
      producedEnglish(exercise)
        .filter(isTemplate)
        .map((text) => `${exercise.id}: "${text}" is a template; ask for a complete sentence`)
    )
  );
}

function duplicateIds(units: readonly Unit[]): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  const ids = units.flatMap((u) => [u.id, ...u.words.map((w) => w.id), ...u.exercises.map((e) => e.id)]);
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${id}: duplicate id`);
    seen.add(id);
  }
  return errors;
}

function unlistedSources(units: readonly Unit[], sourceIds: readonly string[]): string[] {
  return units.flatMap((u) =>
    [{ id: u.id, source: u.source }, ...u.words, ...u.exercises]
      .filter((item) => item.source !== undefined && !sourceIds.includes(item.source))
      .map((item) => `${item.id}: source "${item.source}" is not listed in content/SOURCES.md`)
  );
}

function wordOrder(units: readonly Unit[]): string[] {
  const errors: string[] = [];
  const tracks = [...new Set(units.map((u) => u.track))];
  for (const track of tracks) {
    const known = new Set<string>();
    const knownWords = new Map<string, Word>();
    for (const unit of inTeachingOrder(units.filter((u) => u.track === track))) {
      for (const text of [...unit.words.map((w) => w.en), ...(unit.names ?? [])]) {
        englishTokens(text).forEach((token) => known.add(token));
      }
      unit.words.forEach((w) => knownWords.set(w.id, w));

      const untaught = (id: string, texts: string[]) => {
        const missing = new Set(texts.flatMap(englishTokens).filter((token) => !known.has(token)));
        missing.forEach((token) => errors.push(`${id}: "${token}" is not taught in this unit or earlier`));
      };
      unit.words.forEach((w) => untaught(w.id, w.example ? [w.example.en] : []));
      for (const exercise of unit.exercises) {
        untaught(exercise.id, shownEnglish(exercise));
        if (exercise.type !== 'choose_meaning') continue;
        const word = knownWords.get(exercise.prompt);
        if (!word) {
          errors.push(`${exercise.id}: prompt "${exercise.prompt}" is not a word taught in this unit or earlier`);
        } else if (exercise.answer !== word.vi) {
          errors.push(`${exercise.id}: answer must be the meaning of "${word.en}" ("${word.vi}")`);
        }
      }
    }
  }
  return errors;
}

/** Every cross-unit problem in the given units, as "<id>: <what>"; empty when all is well. */
export function checkContent(units: readonly Unit[], sourceIds: readonly string[]): string[] {
  return [...duplicateIds(units), ...unlistedSources(units, sourceIds), ...wordOrder(units), ...templatesAsked(units)];
}
