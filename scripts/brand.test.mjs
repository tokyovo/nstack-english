// @ts-check
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';

import { ARTWORK } from './brand.mjs';

const ROOT = join(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'assets');
const expo = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')).expo;

// SHA-256 of the images the Expo template shipped in assets/images.
const EXPO_TEMPLATE_PNGS = new Set([
  'fb139c2dee362ebf2070e23b96da6fc0d43f8492de38b8af1fd7223e19b5861d',
  '9e3d0315a33c6799de601dd34cd8bf8cc3a8d16f3bf75592baec2ceb7240b391',
  '6371fc2c12e33ad2215a86c281db3d682a81bebe7c957a842c13b8bf00cceb83',
  'a4e030697a7571b3e95d31860e4da55d2f98e5e861e2b55e414f45a8556828ba',
  '7a667804bb80a6a424a5daf18a2599c4f32237cf06fe78fc0de45dbb09e0eccf',
  '27b060a757a29038c9618586baa0ba3894dbe60d084c6059df497ff429c2d92f',
]);

/** @param {string} dir @returns {string[]} */
function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? [path, ...filesUnder(path)] : [path];
  });
}

/** @param {number} left @param {number} up @param {number} upLeft */
function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
  return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
}

/**
 * Decodes an 8-bit RGB or RGBA PNG (what Chromium screenshots are) into its
 * most common colour and whether every corner pixel is opaque.
 * @param {string} file
 */
function readPng(file) {
  const png = readFileSync(file);
  const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const channels = { 2: 3, 6: 4 }[png[25]];
  assert.ok(png[24] === 8 && channels && png[28] === 0, `${file} is 8-bit RGB or RGBA, not interlaced`);
  /** @type {Buffer[]} */ const idat = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    if (png.toString('latin1', at + 4, at + 8) === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const data = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = data[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const raw = data[y * (stride + 1) + 1 + x];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      pixels[y * stride + x] = (raw + predicted) & 0xff;
    }
  }
  /** @param {number} x @param {number} y */
  const rgba = (x, y) => {
    const [r, g, b, a = 255] = pixels.subarray((y * width + x) * channels, (y * width + x + 1) * channels);
    return [r, g, b, a];
  };
  /** @type {Map<number, number>} */ const counts = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = rgba(x, y).reduce((sum, value) => sum * 256 + value, 0);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const [mostCommon] = [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  const corners = [rgba(0, 0), rgba(width - 1, 0), rgba(0, height - 1), rgba(width - 1, height - 1)];
  return {
    mostCommon: [24, 16, 8, 0].map((shift) => Math.floor(mostCommon / 2 ** shift) % 256),
    opaqueCorners: corners.every((c) => c[3] === 255),
  };
}

/** @param {string} appPath like ./assets/images/icon.png */
const fromApp = (appPath) => relative(ROOT, join(ROOT, appPath));

test('no Expo artwork remains in assets', () => {
  assert.equal(existsSync(join(ASSETS, 'expo.icon')), false, 'assets/expo.icon is gone');
  for (const file of filesUnder(ASSETS)) {
    assert.doesNotMatch(relative(ROOT, file), /expo/i);
    if (file.endsWith('.png')) {
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
      assert.equal(EXPO_TEMPLATE_PNGS.has(hash), false, `${relative(ROOT, file)} is the Expo template image`);
    }
  }
});

test('every image app.json names is rendered by scripts/brand.mjs at its size', () => {
  const splash = expo.plugins.find((/** @type {unknown} */ p) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
  const named = [
    expo.icon,
    expo.ios.icon,
    expo.android.adaptiveIcon.foregroundImage,
    expo.android.adaptiveIcon.backgroundImage,
    expo.android.adaptiveIcon.monochromeImage,
    expo.web.favicon,
    splash.image,
    splash.dark.image,
  ];
  const sizes = new Map(ARTWORK.map((a) => [a.file, a.size]));
  for (const appPath of named) {
    const file = fromApp(appPath);
    assert.ok(sizes.has(file), `${file} is one of the rendered artworks`);
    const png = readFileSync(join(ROOT, file));
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.deepEqual([width, height], [sizes.get(file), sizes.get(file)], file);
  }
  assert.deepEqual(
    ARTWORK.map((a) => a.file).sort(),
    filesUnder(join(ASSETS, 'images')).map((f) => relative(ROOT, f)).sort(),
    'assets/images holds exactly the rendered artwork',
  );
});

test('the icons use the design colours: purple ink behind, cool paper and dark around the splash', () => {
  const ink = [0x5b, 0x3f, 0xa8, 255];
  const iosIcon = readPng(join(ROOT, fromApp(expo.ios.icon)));
  assert.deepEqual(iosIcon.mostCommon, ink, 'iOS icon is mostly purple ink');
  assert.ok(iosIcon.opaqueCorners, 'iOS icon is full bleed');
  assert.deepEqual(readPng(join(ROOT, fromApp(expo.android.adaptiveIcon.backgroundImage))).mostCommon, ink);
  assert.equal(readPng(join(ROOT, fromApp(expo.android.adaptiveIcon.foregroundImage))).mostCommon[3], 0, 'foreground is mostly transparent');
  // At 48 px the faint grid tints nearly every pixel by a step or two.
  const favicon = readPng(join(ROOT, fromApp(expo.web.favicon))).mostCommon;
  assert.ok(favicon.every((value, i) => Math.abs(value - ink[i]) <= 2), `favicon is mostly purple ink, got ${favicon}`);
  assert.equal(expo.android.adaptiveIcon.backgroundColor, '#5B3FA8');
  const splash = expo.plugins.find((/** @type {unknown} */ p) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
  assert.equal(splash.backgroundColor, '#F3F6F4');
  assert.equal(splash.dark.backgroundColor, '#121816');
});
