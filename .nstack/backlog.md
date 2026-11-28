# Backlog

- (unscored) Honest, self-service subscription: clear trial terms, in-app manage/cancel, premium shown immediately, restore purchases after reinstall. Evidence: 4 sources, research.md #1
- (unscored) Progress and streaks never lost on reinstall, re-login or bugs (durable local save, sync recovery). Evidence: 3 sources (severe: data loss), research.md #2
- (unscored) Short grammar and usage explanations in Vietnamese inside lessons (articles, tenses, question forms). Evidence: 5 sources, research.md #3
- (unscored) Free plan that allows real daily learning without per-exercise limits or ad clutter, priced for Vietnam. Evidence: 5 sources, research.md #4
- (unscored) Pronunciation drills for sounds Vietnamese speakers miss (final consonants, th, s/z, clusters) with forgiving scoring. Evidence: 4 sources, research.md #5
- (unscored) Practical real-life phrases and focused lessons for adults, minimal animations and gimmicks. Evidence: 4 sources, research.md #6
- (unscored) Reliability: no crashes, no login loops, layouts that never hide controls on small or large screens. Evidence: 4 sources, research.md #7
- (unscored) Fair daily streak/goal that motivates without punishing and cannot be lost to a bug. Evidence: 3 sources, research.md #8
- (unscored) Parent view of each child's progress, several children under one plan. Evidence: 4 sources, research.md #9
- (unscored) Server HOST setting so a physical phone on the LAN can reach a dev API (emulator uses 10.0.2.2). Evidence: T2 builder
- (unscored) Triage 3 moderate npm audit advisories (prod deps). Evidence: T2 builder; secure slice check
- (unscored) Remove template deps nothing uses (expo-device, expo-web-browser, expo-symbols, expo-glass-effect, @expo/ui, expo-image). Evidence: T1 builder
- (unscored) Replace Expo-branded icon and splash artwork with the app's own. Evidence: T1 builder
- (unscored) android-build: build only x86_64 for the emulator (reactNativeArchitectures) to cut the 23 min first build. Evidence: T3 builder
- (unscored) Jest timeout under CPU load (one flaky failure during gradle). Evidence: T3 builder
- (unscored) UI-string checker: options as a function, tabBarLabel, navigation.setOptions titles. Evidence: review fix builder
- (unscored) UI-string checker: strings outside JSX that reach the user (Alert.alert, confirm, consts rendered later). Evidence: review round 3
