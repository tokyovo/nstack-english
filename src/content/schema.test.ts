import broken from './__fixtures__/broken-unit.json';
import { parseUnit } from './schema';

const word = (id: string, en: string, vi: string) => ({ id: `everyday-a0-u9-${id}`, en, vi });

/** A small unit that satisfies every rule; tests break one thing at a time. */
function validUnit() {
  return {
    id: 'everyday-a0-u9',
    track: 'everyday',
    level: 'a0',
    number: 9,
    title: 'Thử',
    goals: ['Có thể chào hỏi'],
    source: 'original',
    names: ['Lan'],
    words: [
      { ...word('hello', 'Hello', 'Xin chào'), example: { en: 'Hello, Lan!', vi: 'Chào Lan!' } },
      word('goodbye', 'Goodbye', 'Tạm biệt'),
      word('thanks', 'Thank you', 'Cảm ơn'),
      word('fine', "I'm fine", 'Tôi khỏe'),
      { ...word('name', 'My name is ...', 'Tên tôi là ...'), audio: 'My name is' },
      word('how', 'How are you?', 'Bạn khỏe không?'),
    ],
    exercises: [
      { id: 'everyday-a0-u9-e01', type: 'choose_meaning', prompt: 'everyday-a0-u9-hello', options: ['Xin chào', 'Tạm biệt', 'Cảm ơn'], answer: 'Xin chào' },
      { id: 'everyday-a0-u9-e02', type: 'choose_english', prompt: 'Tạm biệt', options: ['Hello', 'Goodbye', 'Thank you'], answer: 'Goodbye' },
      { id: 'everyday-a0-u9-e03', type: 'listen_choose', audio: 'Thank you', options: ['Hello', 'Goodbye', 'Thank you'], answer: 'Thank you' },
      { id: 'everyday-a0-u9-e04', type: 'build_sentence', prompt: 'Tên tôi là Lan.', tiles: ['My', 'name', 'is', 'Lan', 'you'], answer: ['My', 'name', 'is', 'Lan'] },
      { id: 'everyday-a0-u9-e05', type: 'type_answer', prompt: 'Cảm ơn', answer: 'Thank you', accepted: ['Thanks'], hint_vi: 'Hai từ' },
      { id: 'everyday-a0-u9-e06', type: 'choose_meaning', prompt: 'everyday-a0-u9-goodbye', options: ['Xin chào', 'Tạm biệt', 'Cảm ơn'], answer: 'Tạm biệt' },
      { id: 'everyday-a0-u9-e07', type: 'choose_english', prompt: 'Tôi khỏe', options: ["I'm fine", 'Goodbye', 'Hello'], answer: "I'm fine" },
      { id: 'everyday-a0-u9-e08', type: 'listen_choose', audio: 'How are you?', options: ['How are you?', 'Goodbye', 'Hello', 'Thank you'], answer: 'How are you?' },
      { id: 'everyday-a0-u9-e09', type: 'speak', text: 'Hello, Lan!', vi: 'Chào Lan!' },
      { id: 'everyday-a0-u9-e10', type: 'speak', text: "I'm fine, thank you.", vi: 'Tôi khỏe, cảm ơn.' },
    ],
  };
}

/** The valid unit with other accepted orders on its build_sentence "My name is Lan". */
function withAccepted(accepted: string[][]) {
  const unit = validUnit();
  return { ...unit, exercises: unit.exercises.map((e, i) => (i === 3 ? { ...e, accepted } : e)) };
}

describe('parseUnit', () => {
  it('returns the typed unit when it follows every rule', () => {
    const result = parseUnit(validUnit());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unit.id).toBe('everyday-a0-u9');
    expect(result.unit.words[4].audio).toBe('My name is');
    expect(result.unit.exercises[3]).toMatchObject({ type: 'build_sentence', answer: ['My', 'name', 'is', 'Lan'] });
  });

  it('reports every broken rule in the broken fixture, each with where it is', () => {
    const result = parseUnit(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect([...result.errors].sort()).toEqual(
      [
        'everyday-a0-u1: id must be "everyday-a0-u2" (track-level-u<number>)',
        'everyday-a0-u1: needs at least 6 words, has 3',
        'everyday-a0-u1: needs at least 10 exercises, has 7',
        'everyday-a0-u1: needs at least 2 speak items, has 0',
        'everyday-a0-u1.title: missing or empty',
        'everyday-a0-u1.colour: unknown field',
        'everyday-a0-u1-hello.vi: missing or empty',
        'everyday-a0-u1-bye.example.vi: missing or empty',
        'other-x1: id must start with "everyday-a0-u1-"',
        'everyday-a0-u1-e01: answer "Cảm ơn" is not among the options',
        'everyday-a0-u1-e02.options: needs 3 to 4 items, has 2',
        'everyday-a0-u1-e03: options repeat "Hello"',
        'everyday-a0-u1-e04.type: must be one of choose_meaning, choose_english, listen_choose, build_sentence, type_answer, speak',
        'everyday-a0-u1-e05: answer tile "Lan" is not among the tiles',
        'everyday-a0-u1-e06: at most 2 distractor tiles, has 3',
        'everyday-a0-u1-e07.audio: missing or empty',
      ].sort()
    );
  });

  it('keeps alternative build_sentence orders, each made of the tiles', () => {
    const result = parseUnit(withAccepted([['Lan', 'is', 'My', 'name']]));
    expect(result.ok ? result.unit.exercises[3] : result.errors).toMatchObject({
      accepted: [['Lan', 'is', 'My', 'name']],
    });
  });

  it('reports an alternative build_sentence order that uses a tile not among the tiles', () => {
    const result = parseUnit(withAccepted([['Lan', 'is', 'my', 'name']]));
    expect(result.ok ? [] : result.errors).toEqual(['everyday-a0-u9-e04: accepted tile "my" is not among the tiles']);
  });

  it('reads a speak item: the English to say and its Vietnamese meaning', () => {
    const unit = validUnit();
    const speak = { id: 'everyday-a0-u9-e11', type: 'speak', text: "I'm fine, thank you.", vi: 'Tôi khỏe, cảm ơn bạn.' };
    const result = parseUnit({ ...unit, exercises: [...unit.exercises, speak] });
    expect(result.ok ? result.unit.exercises[10] : result.errors).toEqual(speak);
  });

  it('reports a speak item without its English or its Vietnamese meaning', () => {
    const unit = validUnit();
    const speak = { id: 'everyday-a0-u9-e11', type: 'speak', text: ' ', answer: 'Hello' };
    const result = parseUnit({ ...unit, exercises: [...unit.exercises, speak] });
    expect(result.ok ? [] : [...result.errors].sort()).toEqual([
      'everyday-a0-u9.exercises.10.answer: unknown field',
      'everyday-a0-u9-e11.text: missing or empty',
      'everyday-a0-u9-e11.vi: missing or empty',
    ].sort());
  });

  it('reports a unit with fewer than 2 speak items', () => {
    const unit = validUnit();
    const oneSpeak = unit.exercises.map((e, i) =>
      i === 9 ? { id: e.id, type: 'type_answer', prompt: 'Xin chào', answer: 'Hello' } : e
    );
    const result = parseUnit({ ...unit, exercises: oneSpeak });
    expect(result.ok ? [] : result.errors).toEqual(['everyday-a0-u9: needs at least 2 speak items, has 1']);
  });

  it('requires a Vietnamese usage note from A1 up', () => {
    const unit = { ...validUnit(), id: 'everyday-a1-u9', level: 'a1' };
    const result = parseUnit(unit);
    expect(result.ok ? [] : result.errors).toContain('everyday-a1-u9.note_vi: missing or empty');
  });

  it('requires a picture on every word in the kids track', () => {
    const unit = validUnit();
    const kids = {
      ...unit,
      id: 'kids-a0-u9',
      track: 'kids',
      words: unit.words.map((w) => ({ ...w, id: w.id.replace('everyday', 'kids'), picture: '🐱' })),
      exercises: unit.exercises.map((e) => ({ ...e, id: e.id.replace('everyday', 'kids') })),
    };
    kids.words[0] = { ...kids.words[0], picture: '' };
    const result = parseUnit(kids);
    expect(result.ok ? [] : result.errors).toEqual(['kids-a0-u9-hello.picture: missing or empty']);
  });
});
