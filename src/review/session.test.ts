import { units, type Unit } from '@/content';
import { emptyProgress, type Progress } from '@/progress/schema';
import { reviewSession } from '@/review/session';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

type WordSpec = [en: string, vi: string];

function unit(id: string, words: WordSpec[]): Unit {
  const [track] = id.split('-');
  return {
    id,
    track: track === 'kids' || track === 'work' ? track : 'everyday',
    level: 'a0',
    number: Number(id.slice(id.lastIndexOf('u') + 1)),
    title: id,
    goals: [],
    source: 'original',
    words: words.map(([en, vi]) => ({ id: `${id}-${en.toLowerCase().replace(/ /g, '-')}`, en, vi })),
    exercises: [],
  };
}

const COMPLETED = '2026-11-27T08:00:00.000Z';
const aDayLater = new Date(Date.parse(COMPLETED) + DAY);

function completed(...unitIds: string[]): Progress {
  const progress = emptyProgress('local');
  for (const unitId of unitIds) {
    progress.lessons[unitId] = {
      firstCompletedAt: COMPLETED,
      lastCompletedAt: COMPLETED,
      bestCorrect: 10,
      total: 10,
      timesCompleted: 1,
    };
  }
  return progress;
}

const greetings = unit('everyday-a0-u1', [
  ['Hello', 'Xin chào'],
  ['Goodbye', 'Tạm biệt'],
  ['Thank you', 'Cảm ơn'],
  ['Sorry', 'Xin lỗi'],
  ['Yes', 'Vâng'],
  ['No', 'Không'],
]);
const numbers = unit('everyday-a0-u2', [
  ['One', 'Một'],
  ['Two', 'Hai'],
]);
const animals = unit('kids-a0-u1', [
  ['Cat', 'Con mèo'],
  ['Dog', 'Con chó'],
  ['Bird', 'Con chim'],
]);

/** Always picks the first choice, so shuffles are predictable. */
const first = () => 0;

describe('review session', () => {
  it('is empty when no word is due', () => {
    expect(reviewSession(completed('everyday-a0-u1'), [greetings], new Date(COMPLETED), first)).toEqual([]);
  });

  it('asks about each due word once, the longest-waiting first, as choose_meaning, listen_choose, type_answer in turn', () => {
    const session = reviewSession(completed('everyday-a0-u1'), [greetings], aDayLater, first);

    expect(session.map((item) => [item.wordId, item.exercise.type])).toEqual([
      ['everyday-a0-u1-hello', 'choose_meaning'],
      ['everyday-a0-u1-goodbye', 'listen_choose'],
      ['everyday-a0-u1-thank-you', 'type_answer'],
      ['everyday-a0-u1-sorry', 'choose_meaning'],
      ['everyday-a0-u1-yes', 'listen_choose'],
      ['everyday-a0-u1-no', 'type_answer'],
    ]);
  });

  it('stops at 20 words', () => {
    const many = unit(
      'everyday-a0-u3',
      Array.from({ length: 25 }, (_, i): WordSpec => [`Word${i}`, `Từ ${i}`])
    );

    const session = reviewSession(completed('everyday-a0-u3'), [many], aDayLater, first);

    expect(session).toHaveLength(20);
    expect(session[19].wordId).toBe('everyday-a0-u3-word19');
  });

  it('builds each exercise from the word: its meaning, its sound, its spelling', () => {
    const [meaning, listen, typed] = reviewSession(completed('everyday-a0-u1'), [greetings], aDayLater, first);

    expect(meaning.exercise).toMatchObject({
      type: 'choose_meaning',
      prompt: 'everyday-a0-u1-hello',
      answer: 'Xin chào',
    });
    expect(listen.exercise).toMatchObject({ type: 'listen_choose', audio: 'Goodbye', answer: 'Goodbye' });
    expect(typed.exercise).toEqual({
      id: 'everyday-a0-u1-thank-you',
      type: 'type_answer',
      prompt: 'Cảm ơn',
      answer: 'Thank you',
    });
  });

  it('offers up to 4 different options, the answer among them, the others from learned words of the same track', () => {
    const progress = completed('everyday-a0-u1', 'kids-a0-u1');
    const session = reviewSession(progress, [greetings, numbers, animals], aDayLater, Math.random);
    // Never a word of another track, nor of a unit not yet finished (everyday u2).
    const learned = {
      everyday: { choose_meaning: greetings.words.map((w) => w.vi), listen_choose: greetings.words.map((w) => w.en) },
      kids: { choose_meaning: animals.words.map((w) => w.vi), listen_choose: animals.words.map((w) => w.en) },
    };
    expect(session).toHaveLength(9);

    for (const { wordId, exercise } of session) {
      if (exercise.type === 'type_answer') continue;
      if (exercise.type !== 'choose_meaning' && exercise.type !== 'listen_choose') throw new Error(exercise.type);
      const track = wordId.startsWith('kids') ? 'kids' : 'everyday';
      const options = new Set(exercise.options);
      // Kids has learned only 3 words, so it offers all 3.
      expect(options.size).toBe(track === 'kids' ? 3 : 4);
      expect(options).toContain(exercise.answer);
      for (const option of options) expect(learned[track][exercise.type]).toContain(option);
    }
  });

  it('asks for the spelling when the track has too few learned words to offer a choice', () => {
    const lone = unit('work-a0-u1', [['Office', 'Văn phòng']]);

    const session = reviewSession(completed('work-a0-u1'), [lone], aDayLater, first);

    expect(session.map((item) => item.exercise.type)).toEqual(['type_answer']);
  });

  it('asks no word aloud unless the device can hear speech', () => {
    const session = reviewSession(completed('everyday-a0-u1'), [greetings], aDayLater, first);

    expect(session.some((item) => item.exercise.type === 'speak')).toBe(false);
  });

  it('asks the longest due phrase aloud, once per session, when the device can hear speech', () => {
    const session = reviewSession(completed('everyday-a0-u1'), [greetings], aDayLater, first, { speak: true });

    expect(session.map((item) => [item.wordId, item.exercise.type])).toEqual([
      ['everyday-a0-u1-hello', 'choose_meaning'],
      ['everyday-a0-u1-goodbye', 'listen_choose'],
      ['everyday-a0-u1-thank-you', 'speak'],
      ['everyday-a0-u1-sorry', 'choose_meaning'],
      ['everyday-a0-u1-yes', 'listen_choose'],
      ['everyday-a0-u1-no', 'type_answer'],
    ]);
    expect(session[2].exercise).toEqual({
      id: 'everyday-a0-u1-thank-you',
      type: 'speak',
      text: 'Thank you',
      vi: 'Cảm ơn',
    });
  });

  it('asks the only due word aloud when it is the whole session', () => {
    const lone = unit('work-a0-u1', [['Office', 'Văn phòng']]);

    const session = reviewSession(completed('work-a0-u1'), [lone], aDayLater, first, { speak: true });

    expect(session.map((item) => item.exercise.type)).toEqual(['speak']);
  });

  it('puts the answer where the random number says', () => {
    const progress = completed('everyday-a0-u1');
    const [atStart] = reviewSession(progress, [greetings], aDayLater, () => 0);
    const [atEnd] = reviewSession(progress, [greetings], aDayLater, () => 0.99);

    if (atStart.exercise.type !== 'choose_meaning' || atEnd.exercise.type !== 'choose_meaning') throw new Error();
    expect(atStart.exercise.options[0]).toBe('Xin chào');
    expect(atEnd.exercise.options[3]).toBe('Xin chào');
  });

  // A template such as "My name is ..." is not a sentence anyone can type or say as written.
  const templates = unit('work-a0-u2', [
    ["I'm a ... / I'm an ...", 'Tôi là (một) ...'],
    ['My name is ...', 'Tên tôi là ...'],
    ['Where is the ...?', '... ở đâu?'],
    ['Nice to meet you', 'Rất vui được gặp bạn'],
    ['Hi', 'Chào'],
    ['Job', 'Nghề'],
  ]);

  it('never asks a template to be typed or said, only recognised by meaning or sound', () => {
    const session = reviewSession(completed('work-a0-u2'), [templates], aDayLater, first, { speak: true });

    expect(session.map((item) => [item.wordId, item.exercise.type])).toEqual([
      ["work-a0-u2-i'm-a-...-/-i'm-an-...", 'choose_meaning'],
      ['work-a0-u2-my-name-is-...', 'listen_choose'],
      ['work-a0-u2-where-is-the-...?', 'choose_meaning'],
      ['work-a0-u2-nice-to-meet-you', 'speak'],
      ['work-a0-u2-hi', 'listen_choose'],
      ['work-a0-u2-job', 'type_answer'],
    ]);
  });

  it('asks nothing aloud when every due word is a template', () => {
    const onlyTemplates = unit('work-a0-u2', [
      ['My name is ...', 'Tên tôi là ...'],
      ['Where is the ...?', '... ở đâu?'],
    ]);

    const session = reviewSession(completed('work-a0-u2'), [onlyTemplates], aDayLater, first, { speak: true });

    expect(session.map((item) => item.exercise.type)).toEqual(['choose_meaning', 'listen_choose']);
  });

  it('asks a lone template by its meaning, even with no other word to choose from', () => {
    const lone = unit('work-a0-u3', [['Where is the ...?', '... ở đâu?']]);

    const [item] = reviewSession(completed('work-a0-u3'), [lone], aDayLater, first, { speak: true });

    expect(item.exercise).toEqual({
      id: 'work-a0-u3-where-is-the-...?',
      type: 'choose_meaning',
      prompt: 'work-a0-u3-where-is-the-...?',
      options: ['... ở đâu?'],
      answer: '... ở đâu?',
    });
  });

  it.each(units.map((u) => [u.id, u] as const))(
    'in %s, asks to type or say only complete English, never a template with "..."',
    (_id, real) => {
      const asked = [false, true].flatMap((speak) =>
        reviewSession(completed(real.id), [real], aDayLater, Math.random, { speak }).flatMap(({ exercise }) =>
          exercise.type === 'type_answer' ? [exercise.answer] : exercise.type === 'speak' ? [exercise.text] : []
        )
      );

      expect(asked.length).toBeGreaterThan(0);
      expect(asked.filter((text) => text.includes('...'))).toEqual([]);
    }
  );
});
