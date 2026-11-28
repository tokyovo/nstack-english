import { seeded } from '@/lesson/__fixtures__/seeded';
import { shuffled } from '@/lesson/shuffle';

describe('shuffled', () => {
  it('returns every item exactly once and leaves the input as it was', () => {
    const items = ['Xin chào', 'Tạm biệt', 'Cảm ơn', 'Xin lỗi'];
    const random = seeded(7);
    for (let i = 0; i < 50; i++) {
      expect([...shuffled(items, random)].sort()).toEqual(['Cảm ơn', 'Tạm biệt', 'Xin chào', 'Xin lỗi']);
    }
    expect(items).toEqual(['Xin chào', 'Tạm biệt', 'Cảm ơn', 'Xin lỗi']);
  });

  it('puts the first item in every position about equally often', () => {
    const random = seeded(42);
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[shuffled(['answer', 'b', 'c'], random).indexOf('answer')]++;

    // A fair shuffle puts it at each of 3 positions 1000 times; 900 leaves room for chance.
    for (const count of counts) expect(count).toBeGreaterThan(900);
  });
});
