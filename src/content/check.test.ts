import { checkContent, englishTokens } from './check';
import type { Exercise, Unit, Word } from './schema';

function unit(id: string, words: Word[], exercises: Exercise[], extra: Partial<Unit> = {}): Unit {
  const [track, level, n] = id.split('-');
  return {
    id,
    track: track as Unit['track'],
    level: level as Unit['level'],
    number: Number(n.slice(1)),
    title: 'Thử',
    goals: ['Có thể thử'],
    source: 'original',
    words,
    exercises,
    ...extra,
  };
}

const hello: Word = { id: 'everyday-a0-u1-hello', en: 'Hello', vi: 'Xin chào' };
const bye: Word = { id: 'everyday-a0-u1-bye', en: 'Goodbye', vi: 'Tạm biệt' };
const thanks: Word = { id: 'everyday-a0-u2-thanks', en: 'Thank you', vi: 'Cảm ơn' };

describe('englishTokens', () => {
  it('lowercases words, keeps apostrophes and drops punctuation and digits', () => {
    expect(englishTokens("I’m fine, thank you! 10 ...")).toEqual(["i'm", 'fine', 'thank', 'you']);
  });
});

describe('checkContent', () => {
  it('accepts units that only use words taught in the same unit or earlier', () => {
    const u1 = unit('everyday-a0-u1', [hello, bye], [
      { id: 'everyday-a0-u1-e1', type: 'listen_choose', audio: 'Hello', options: ['Hello', 'Goodbye', 'Hello Lan'], answer: 'Hello' },
    ], { names: ['Lan'] });
    const u2 = unit('everyday-a0-u2', [thanks], [
      { id: 'everyday-a0-u2-e1', type: 'build_sentence', prompt: 'Cảm ơn, tạm biệt.', tiles: ['Thank', 'you', 'goodbye'], answer: ['Thank', 'you', 'goodbye'] },
      { id: 'everyday-a0-u2-e2', type: 'choose_meaning', prompt: 'everyday-a0-u1-hello', options: ['Xin chào', 'Cảm ơn', 'Tạm biệt'], answer: 'Xin chào' },
      { id: 'everyday-a0-u2-e3', type: 'type_answer', prompt: 'Cảm ơn', answer: 'Thank you', accepted: ['Thanks'] },
    ]);
    expect(checkContent([u2, u1], ['original'])).toEqual([]);
  });

  it('reports an English word used before the unit that teaches it', () => {
    const u1 = unit('everyday-a0-u1', [hello, { ...bye, example: { en: 'Goodbye, my friend.', vi: 'Tạm biệt bạn.' } }], [
      { id: 'everyday-a0-u1-e1', type: 'choose_english', prompt: 'Cảm ơn', options: ['Hello', 'Goodbye', 'Thank you'], answer: 'Thank you' },
    ]);
    const u2 = unit('everyday-a0-u2', [thanks], []);
    expect(checkContent([u1, u2], ['original'])).toEqual([
      'everyday-a0-u1-bye: "my" is not taught in this unit or earlier',
      'everyday-a0-u1-bye: "friend" is not taught in this unit or earlier',
      'everyday-a0-u1-e1: "thank" is not taught in this unit or earlier',
      'everyday-a0-u1-e1: "you" is not taught in this unit or earlier',
    ]);
  });

  it('does not let one track use words another track teaches', () => {
    const work = unit('work-a0-u1', [], [
      { id: 'work-a0-u1-e1', type: 'type_answer', prompt: 'Xin chào', answer: 'Hello' },
    ]);
    expect(checkContent([unit('everyday-a0-u1', [hello], []), work], ['original'])).toEqual([
      'work-a0-u1-e1: "hello" is not taught in this unit or earlier',
    ]);
  });

  it('reports a choose_meaning prompt that is not a word taught so far, or whose answer is not its meaning', () => {
    const u1 = unit('everyday-a0-u1', [hello, bye], [
      { id: 'everyday-a0-u1-e1', type: 'choose_meaning', prompt: 'everyday-a0-u2-thanks', options: ['Cảm ơn', 'Xin chào', 'Tạm biệt'], answer: 'Cảm ơn' },
      { id: 'everyday-a0-u1-e2', type: 'choose_meaning', prompt: 'everyday-a0-u1-bye', options: ['Cảm ơn', 'Xin chào', 'Tạm biệt'], answer: 'Xin chào' },
    ]);
    expect(checkContent([u1, unit('everyday-a0-u2', [thanks], [])], ['original'])).toEqual([
      'everyday-a0-u1-e1: prompt "everyday-a0-u2-thanks" is not a word taught in this unit or earlier',
      'everyday-a0-u1-e2: answer must be the meaning of "Goodbye" ("Tạm biệt")',
    ]);
  });

  it('reports duplicate ids across units and sources not listed in SOURCES.md', () => {
    const u1 = unit('everyday-a0-u1', [hello], [], { source: 'tatoeba' });
    const u2 = unit('everyday-a0-u2', [{ ...thanks, id: 'everyday-a0-u1-hello', source: 'wordnet' }], []);
    expect(checkContent([u1, u2, u1], ['original', 'tatoeba']).sort()).toEqual(
      [
        'everyday-a0-u1: duplicate id',
        'everyday-a0-u1-hello: duplicate id',
        'everyday-a0-u1-hello: duplicate id',
        'everyday-a0-u1-hello: source "wordnet" is not listed in content/SOURCES.md',
      ].sort()
    );
  });
});
