import { interpolate, t } from '@/i18n';

describe('t', () => {
  it('returns the Vietnamese message for a key', () => {
    expect(t('app.name')).toBe('Học Tiếng Anh');
  });
});

describe('interpolate', () => {
  it('replaces {name} placeholders with the given values', () => {
    expect(interpolate('Còn {count} bài, cố lên {name}!', { count: 3, name: 'Lan' })).toBe(
      'Còn 3 bài, cố lên Lan!'
    );
  });

  it('leaves a placeholder untouched when no value is given for it', () => {
    expect(interpolate('Chào {name}', {})).toBe('Chào {name}');
  });
});
