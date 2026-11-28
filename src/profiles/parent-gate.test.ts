import { isGateAnswer, newGateQuestion } from './parent-gate';

describe('parent gate', () => {
  it('asks a multiplication of two numbers from 6 to 9', () => {
    expect(newGateQuestion(() => 0)).toEqual({ a: 6, b: 6 });
    expect(newGateQuestion(() => 0.99)).toEqual({ a: 9, b: 9 });
    const rolls = [0.3, 0.6];
    expect(newGateQuestion(() => rolls.shift() ?? 0)).toEqual({ a: 7, b: 8 });
  });

  it('accepts the product written in digits, with spaces around it', () => {
    expect(isGateAnswer({ a: 7, b: 8 }, '56')).toBe(true);
    expect(isGateAnswer({ a: 7, b: 8 }, ' 56 ')).toBe(true);
  });

  it('refuses another number, an empty answer and anything that is not digits', () => {
    expect(isGateAnswer({ a: 7, b: 8 }, '54')).toBe(false);
    expect(isGateAnswer({ a: 7, b: 8 }, '')).toBe(false);
    expect(isGateAnswer({ a: 7, b: 8 }, '56.0')).toBe(false);
    expect(isGateAnswer({ a: 7, b: 8 }, 'năm mươi sáu')).toBe(false);
  });
});
