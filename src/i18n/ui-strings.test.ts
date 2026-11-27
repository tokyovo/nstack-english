import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { findUiStringLiterals } from './ui-strings';

const srcDir = join(__dirname, '..');

function check(source: string) {
  return findUiStringLiterals(source, 'example.tsx').map((finding) => finding.text);
}

function tsxFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFilesIn(path);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
  });
}

describe('findUiStringLiterals', () => {
  it('reports JSX text that contains letters', () => {
    expect(check('const A = () => <Text>Xin chào</Text>;')).toEqual(['Xin chào']);
  });

  it('allows JSX text that is only punctuation, digits or whitespace', () => {
    expect(check('const A = () => <Text>{a} · 1/2 {"–"} {`3`}</Text>;')).toEqual([]);
  });

  it('reports string and plain template literals inside JSX children', () => {
    expect(check('const A = () => <Text>{"Bắt đầu"}{`Tiếp tục`}{ok ? "Đúng" : "Sai"}</Text>;')).toEqual([
      'Bắt đầu',
      'Tiếp tục',
      'Đúng',
      'Sai',
    ]);
  });

  it('reports literals rendered by && and ??, not strings used in comparisons', () => {
    expect(
      check('const A = () => <Text>{Platform.OS === "web" && "Trên web"}{name ?? "Bạn"}</Text>;')
    ).toEqual(['Trên web', 'Bạn']);
  });

  it('allows children that come from t() or variables', () => {
    expect(check('const A = () => <Text>{t("app.name")}{`${count}`}{name}</Text>;')).toEqual([]);
  });

  it('reports literal text props users can see or hear', () => {
    const source = `const A = () => (
      <View>
        <Pressable accessibilityLabel="Nghe" accessibilityHint={'Phát âm'} />
        <TextInput placeholder={\`Nhập từ\`} />
        <Img alt="ảnh" title="Tiêu đề" aria-label="Đóng" label="Nhãn" />
      </View>
    );`;
    expect(check(source)).toEqual(['Nghe', 'Phát âm', 'Nhập từ', 'ảnh', 'Tiêu đề', 'Đóng', 'Nhãn']);
  });

  it('ignores literal props that are not shown to users', () => {
    expect(check('const A = () => <View testID="welcome-card" style={s} role="header" />;')).toEqual([]);
  });

  it('reports the line of each finding', () => {
    const findings = findUiStringLiterals('const A = () => (\n  <Text>\n    Hello\n  </Text>\n);', 'a.tsx');
    expect(findings).toEqual([{ file: 'a.tsx', line: 3, text: 'Hello' }]);
  });

  it('reports the literals planted in the fixture', () => {
    const fixture = readFileSync(join(__dirname, '__fixtures__', 'planted.tsx.txt'), 'utf8');
    expect(check(fixture)).toEqual(['Chào mừng bạn', 'Bắt đầu học']);
  });
});

describe('UI text in src', () => {
  it('comes only from the messages file through t()', () => {
    const findings = tsxFilesIn(srcDir).flatMap((file) =>
      findUiStringLiterals(readFileSync(file, 'utf8'), relative(srcDir, file))
    );
    expect(findings).toEqual([]);
  });
});
