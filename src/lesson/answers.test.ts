import type { Exercise } from '@/content';

import { isSentenceCorrect, isTypedAnswerCorrect, rightAnswer } from './answers';

type Typed = Extract<Exercise, { type: 'type_answer' }>;
type Sentence = Extract<Exercise, { type: 'build_sentence' }>;

const goodbye: Typed = {
  id: 'everyday-a0-u1-e09',
  type: 'type_answer',
  prompt: 'Tạm biệt',
  answer: 'Goodbye',
  accepted: ['Good-bye', 'Bye'],
};

const myName: Sentence = {
  id: 'everyday-a0-u1-e06',
  type: 'build_sentence',
  prompt: 'Tên tôi là Lan.',
  tiles: ['name', 'Lan', 'My', 'you', 'is'],
  answer: ['My', 'name', 'is', 'Lan'],
  accepted: [['Lan', 'is', 'My', 'name']],
};

describe('type_answer', () => {
  it.each(['Goodbye', 'goodbye', 'GOODBYE', '  Goodbye  ', 'Goodbye.', 'Goodbye!', 'Goodbye ?'])(
    'accepts "%s"',
    (typed) => {
      expect(isTypedAnswerCorrect(goodbye, typed)).toBe(true);
    }
  );

  it.each(['good-bye', 'Bye!', ' bye '])('accepts the listed variant "%s"', (typed) => {
    expect(isTypedAnswerCorrect(goodbye, typed)).toBe(true);
  });

  it('accepts extra spaces between words', () => {
    const thanks: Typed = { id: 'x-e1', type: 'type_answer', prompt: 'Cảm ơn', answer: 'Thank you' };
    expect(isTypedAnswerCorrect(thanks, 'thank    you')).toBe(true);
  });

  it('accepts a typographic apostrophe for a straight one', () => {
    const fine: Typed = { id: 'x-e2', type: 'type_answer', prompt: 'Tôi khỏe', answer: "I'm fine" };
    expect(isTypedAnswerCorrect(fine, 'I’m fine')).toBe(true);
  });

  it.each(['Good bye', 'Hello', '', 'Goodbye Nam', '.'])('rejects "%s"', (typed) => {
    expect(isTypedAnswerCorrect(goodbye, typed)).toBe(false);
  });
});

describe('build_sentence', () => {
  it('accepts the tiles in the answer order', () => {
    expect(isSentenceCorrect(myName, ['My', 'name', 'is', 'Lan'])).toBe(true);
  });

  it('accepts an alternative order listed as accepted', () => {
    expect(isSentenceCorrect(myName, ['Lan', 'is', 'My', 'name'])).toBe(true);
  });

  it('rejects another order, a missing tile or an extra tile', () => {
    expect(isSentenceCorrect(myName, ['name', 'My', 'is', 'Lan'])).toBe(false);
    expect(isSentenceCorrect(myName, ['My', 'name', 'is'])).toBe(false);
    expect(isSentenceCorrect(myName, ['My', 'name', 'is', 'Lan', 'you'])).toBe(false);
  });
});

describe('rightAnswer', () => {
  it('writes a built sentence as one line of text', () => {
    expect(rightAnswer(myName)).toBe('My name is Lan');
  });

  it('gives the answer of a typed exercise', () => {
    expect(rightAnswer(goodbye)).toBe('Goodbye');
  });
});
