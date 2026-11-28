import { judgeSpeech, similarity, spokenWords } from './score';

describe('spokenWords', () => {
  it('lowercases, drops punctuation and expands contractions', () => {
    expect(spokenWords("I’m fine, thank you. What's your name? I don't know!")).toEqual([
      'i', 'am', 'fine', 'thank', 'you', 'what', 'is', 'your', 'name', 'i', 'do', 'not', 'know',
    ]);
  });

  it('says small numbers as words, as recognisers often write them as digits', () => {
    expect(spokenWords('I have 2 sisters and 10 pens')).toEqual(['i', 'have', 'two', 'sisters', 'and', 'ten', 'pens']);
  });

  it("expands can't and won't to their full words", () => {
    expect(spokenWords("I can't. It won't.")).toEqual(['i', 'can', 'not', 'it', 'will', 'not']);
  });
});

describe('similarity', () => {
  it('is the share of words that line up, against the longer of the two', () => {
    expect(similarity('nice to meet you', 'nice to meet')).toBe(0.75);
    expect(similarity('good morning', 'good night')).toBe(0.5);
    expect(similarity('hello', 'hello')).toBe(1);
    expect(similarity('hello', '')).toBe(0);
  });
});

describe('judgeSpeech', () => {
  it.each([
    ["I'm fine, thank you.", 'I am fine thank you'],
    ["What's your name?", 'what is your name'],
    ['My name is Lan.', "my name's Lan"],
    ['I have two sisters.', 'I have 2 sisters'],
    ["I don't know.", 'I do not know'],
    // One word in five misheard is still 0.8.
    ["I'm fine, thank you.", "I'm fine thank too"],
  ])('passes "%s" said as "%s"', (expected, heard) => {
    expect(judgeSpeech(expected, [heard])).toEqual({ heard, passed: true });
  });

  it.each([
    ['Nice to meet you', 'nice to meet'],
    ['Good morning', 'good night'],
    ['Hello', 'yellow'],
    ['Thank you', ''],
  ])('fails "%s" said as "%s"', (expected, heard) => {
    expect(judgeSpeech(expected, [heard])).toEqual({ heard, passed: false });
  });

  it('passes when any of the recogniser’s alternatives matches, and gives the closest one', () => {
    expect(judgeSpeech('Good morning', ['good mourning sir', 'good morning'])).toEqual({
      heard: 'good morning',
      passed: true,
    });
  });

  it('gives the closest alternative when none passes', () => {
    expect(judgeSpeech('Nice to meet you', ['nice tea', 'nice to meet'])).toEqual({ heard: 'nice to meet', passed: false });
  });

  it('fails when nothing was heard', () => {
    expect(judgeSpeech('Good morning', [])).toEqual({ heard: '', passed: false });
  });
});
