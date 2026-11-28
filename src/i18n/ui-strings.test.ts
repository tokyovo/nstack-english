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

  it('reports template literals whose static text has letters, in children and props', () => {
    const source = 'const A = () => <Text accessibilityLabel={`Nghe ${w}`}>{`Còn ${n} bài`}{`${a}/${b}`}</Text>;';
    expect(check(source)).toEqual(['Nghe ${…}', 'Còn ${…} bài']);
  });

  it('reports both operands of string concatenation', () => {
    expect(check('const A = () => <Text title={name + " ơi"}>{"Chào " + name}{a + b}</Text>;')).toEqual([
      'ơi',
      'Chào',
    ]);
  });

  it('reports template literals in conditional branches', () => {
    expect(check('const A = () => <Text>{ok ? `Còn ${n} bài` : t("done")}</Text>;')).toEqual(['Còn ${…} bài']);
  });

  it('reports title and headerTitle in an object passed to options', () => {
    const source = `const A = () => (
      <Stack>
        <Stack.Screen name="index" options={{ title: "Trang chủ", headerShown: false }} />
        <Stack.Screen name="learn" options={{ headerTitle: \`Học \${n}\`, animation: "fade" }} />
        <Stack.Screen name="t" options={{ title: t("home") }} />
      </Stack>
    );`;
    expect(check(source)).toEqual(['Trang chủ', 'Học ${…}']);
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
    expect(check(fixture)).toEqual(['Trang chủ', 'Chào mừng bạn', 'Bắt đầu học', 'Còn ${…} bài', 'Xin chào']);
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
