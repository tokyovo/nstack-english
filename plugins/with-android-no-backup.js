// Turns Android Auto Backup off. Progress lives on the server and the device
// store is a cache; the sign-in token in expo-secure-store is encrypted with a
// Keystore key that never leaves the device, so a restored copy could not be read.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidNoBackup(config) {
  return withAndroidManifest(config, (config) => {
    AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults).$['android:allowBackup'] = 'false';
    return config;
  });
};
