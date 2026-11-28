// The native config test: the Android manifest and iOS Info.plist that
// `expo prebuild` would write, read once from `expo config --type introspect`.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

type Attributes = { $: Record<string, string> };
type Introspected = {
  _internal: {
    modResults: {
      android: {
        manifest: {
          manifest: { 'uses-permission'?: Attributes[]; application: Attributes[] };
        };
      };
      ios: { infoPlist: Record<string, unknown> };
    };
  };
};

const root = join(__dirname, '..', '..');

function introspect(): Introspected {
  const json = execFileSync(join(root, 'node_modules', '.bin', 'expo'), ['config', '--type', 'introspect', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  return JSON.parse(json);
}

const { modResults } = introspect()._internal;
const manifest = modResults.android.manifest.manifest;

/** Permissions the app asks for: entries marked tools:node="remove" are taken out when the manifests merge. */
const requested = (manifest['uses-permission'] ?? [])
  .filter((p) => p.$['tools:node'] !== 'remove')
  .map((p) => p.$['android:name']);

describe('native config', () => {
  it('asks Android only for the internet and the microphone the speaking practice uses', () => {
    expect(requested.sort()).toEqual(['android.permission.INTERNET', 'android.permission.RECORD_AUDIO']);
  });

  it('removes the storage, overlay and vibrate permissions that libraries would merge in', () => {
    const removed = (manifest['uses-permission'] ?? [])
      .filter((p) => p.$['tools:node'] === 'remove')
      .map((p) => p.$['android:name']);

    expect(removed).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.VIBRATE',
      ]),
    );
  });

  it('keeps the secure token store out of Android backups and device transfers', () => {
    const application = manifest.application[0].$;

    expect(application['android:allowBackup']).toBe('false');
    expect(application['android:fullBackupContent']).toBe('@xml/secure_store_backup_rules');
    expect(application['android:dataExtractionRules']).toBe('@xml/secure_store_data_extraction_rules');
  });

  it('declares no Face ID use on iOS', () => {
    expect(modResults.ios.infoPlist).not.toHaveProperty('NSFaceIDUsageDescription');
  });
});
