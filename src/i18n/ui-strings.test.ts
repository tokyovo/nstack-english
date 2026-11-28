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

  it('reports title in screenOptions on a navigator', () => {
    expect(check('const A = () => <Stack screenOptions={{ title: "Trang chủ" }} />;')).toEqual(['Trang chủ']);
  });

  it('reports title returned by an options function', () => {
    expect(check('const A = () => <Stack.Screen options={() => ({ title: "Trang chủ" })} />;')).toEqual([
      'Trang chủ',
    ]);
  });

  it('reports values of quoted object keys', () => {
    expect(check('const A = () => <Stack.Screen options={{ "title": "Trang chủ" }} />;')).toEqual(['Trang chủ']);
  });

  it('reports tabBarLabel and any other unknown option key', () => {
    const source = 'const A = () => <Tabs.Screen options={{ tabBarLabel: "Học", tabBarBadge: `Mới` }} />;';
    expect(check(source)).toEqual(['Học', 'Mới']);
  });

  it('reports literals wrapped in as, satisfies or parentheses', () => {
    const source = 'const A = () => <Text>{"Xin chào" as string}{("Tạm biệt" satisfies string)}</Text>;';
    expect(check(source)).toEqual(['Xin chào', 'Tạm biệt']);
  });

  it('reports every element of array children', () => {
    expect(check('const A = () => <Text>{["Xin", "chào"]}</Text>;')).toEqual(['Xin', 'chào']);
  });

  it('reports literals in render callbacks and nested objects of unknown props', () => {
    const source = `const A = () => (
      <List
        empty={{ message: { text: "Trống" } }}
        renderItem={({ item }) => (item.done ? <Text>Xong</Text> : null)}
        format={(n) => { return "Còn " + n; }}
      />
    );`;
    expect(check(source)).toEqual(['Trống', 'Xong', 'Còn']);
  });

  it('reports values passed to t() as substitutions, but not the message key', () => {
    expect(check('const A = () => <Text>{t("greet", { who: "Bạn" })}</Text>;')).toEqual(['Bạn']);
  });

  it('reports object values under keys that are only allowlisted as props', () => {
    expect(check('const A = () => <Text>{t("greet", { name: "Bạn", type: "Lỗi" })}<F data={{ name: "Họ và tên" }} /></Text>;')).toEqual(['Bạn', 'Lỗi', 'Họ và tên']);
  });

  it('ignores the props and option keys on the allowlist, including their nested values', () => {
    const source = `const A = () => (
      <View testID="welcome-card" nativeID="card" role="header" accessibilityRole="button"
        accessibilityLanguage="en" lang="en" style={{ fontFamily: "BeVietnamPro_400Regular" }}
        pointerEvents="none" importantForAccessibility="no-hide-descendants" key={\`v\${left}\`}>
        <ThemedText type="word">{t("welcome.sampleWord")}</ThemedText>
        <Link href="/learn" />
        <Pressable onPress={() => router.push({ pathname: "/track/[id]", params: { id } })} />
        <TextInput keyboardType="default" autoComplete="off" autoCapitalize="none" textContentType="none"
          inputMode="text" returnKeyType="done" enterKeyHint="done" />
        <Image resizeMode="cover" />
        <Icon name="home" />
        <Stack.Screen name="index" options={{ animation: "fade", presentation: "modal", "animation": "none" }} />
        <Stack screenOptions={{ headerTitleStyle: { fontFamily: "BeVietnamPro_700Bold" } }} />
        <StatusBar style="auto" />
      </View>
    );`;
    expect(check(source)).toEqual([]);
  });

  it('ignores strings compared against or used as an index, not rendered', () => {
    expect(check('const A = () => <Text>{mode !== "dark" && x["label"]}{typeof n === "string" ? n : ""}</Text>;')).toEqual(
      []
    );
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
    expect(check(fixture)).toEqual([
      'Trang chủ',
      'Chào mừng bạn',
      'Bắt đầu học',
      'Còn ${…} bài',
      'Xin chào',
      'Bài học',
      'Tiếp',
      'Hồ sơ',
      'Học',
      'Chào',
      'bạn',
      'Đóng',
    ]);
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
