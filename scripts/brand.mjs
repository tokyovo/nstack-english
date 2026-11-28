// @ts-check
// The app's icon, adaptive icon, splash image and favicon: SVG drawn here,
// rendered to PNG by Playwright's Chromium. Run `npm run brand` after a change.
//
// One scene, a white lowercase "a" (Be Vietnam Pro 700) on the "vở ô ly"
// notebook grid in purple ink, is laid out on the 108 dp Android adaptive
// canvas (1536 units). The iOS icon, splash and favicon show its 72 dp
// visible centre, so every artwork crops the same picture the same way.
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const INK = '#5B3FA8';
const WHITE = '#FFFFFF';

const SCENE = 1536; // 108 dp
const VISIBLE = 1024; // the 72 dp a launcher shows
const CELL = VISIBLE / 10; // one ô ly square: ten across the icon
const GLYPH_CELLS = 5; // the x-height of the "a", in squares
const GRID_ORIGIN = SCENE / 2 - (GLYPH_CELLS * CELL) / 2; // the line the "a" reaches up to

/** @typedef {{ ascent: number, left: number, right: number }} Metrics ink box of "a" at 1000 px */

/** @param {'scene' | 'visible'} view */
const viewBox = (view) => {
  const inset = view === 'scene' ? 0 : (SCENE - VISIBLE) / 2;
  return `${inset} ${inset} ${SCENE - 2 * inset} ${SCENE - 2 * inset}`;
};

/**
 * The squared paper: a line every square, and the three faint writing lines
 * inside each. The icon's edges fall mid-square, so no line runs along them.
 */
function grid() {
  const main = [];
  const sub = [];
  const quarter = CELL / 4;
  const first = -Math.floor(GRID_ORIGIN / quarter);
  for (let i = first; GRID_ORIGIN + i * quarter <= SCENE; i++) {
    const at = (GRID_ORIGIN + i * quarter).toFixed(1);
    if (i % 4 === 0) main.push(`M0 ${at}H${SCENE}M${at} 0V${SCENE}`);
    else sub.push(`M0 ${at}H${SCENE}`);
  }
  return (
    `<path d="${sub.join('')}" stroke="${WHITE}" stroke-opacity="0.13" stroke-width="3"/>` +
    `<path d="${main.join('')}" stroke="${WHITE}" stroke-opacity="0.3" stroke-width="5"/>`
  );
}

/** The "a", its x-height spanning five squares from line to line, in the centre. @param {Metrics} m */
function glyph(m) {
  const height = GLYPH_CELLS * CELL;
  const fontSize = (height / m.ascent) * 1000;
  const baseline = SCENE / 2 + height / 2;
  const x = SCENE / 2 - (((m.left + m.right) / 2) * fontSize) / 1000;
  return `<text x="${x.toFixed(1)}" y="${baseline}" fill="${WHITE}" font-family="Be Vietnam Pro" font-weight="700" font-size="${fontSize.toFixed(1)}">a</text>`;
}

/** @param {string} viewBoxValue @param {string} body */
const svg = (viewBoxValue, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxValue}" width="100%" height="100%">${body}</svg>`;

/** @param {Metrics} m @param {{ rounded: boolean }} options */
function badge(m, { rounded }) {
  const inset = (SCENE - VISIBLE) / 2;
  const shape = rounded
    ? `<clipPath id="c"><rect x="${inset}" y="${inset}" width="${VISIBLE}" height="${VISIBLE}" rx="${VISIBLE * 0.22}"/></clipPath>`
    : '';
  return svg(
    viewBox('visible'),
    `${shape}<g${rounded ? ' clip-path="url(#c)"' : ''}><rect width="${SCENE}" height="${SCENE}" fill="${INK}"/>${grid()}${glyph(m)}</g>`,
  );
}

/** @type {{ file: string, size: number, draw: (m: Metrics) => string }[]} */
export const ARTWORK = [
  // iOS and the Expo default icon: full bleed and opaque; the system rounds the corners.
  { file: 'assets/images/icon.png', size: 1024, draw: (m) => badge(m, { rounded: false }) },
  {
    file: 'assets/images/android-icon-background.png',
    size: 1024,
    draw: () => svg(viewBox('scene'), `<rect width="${SCENE}" height="${SCENE}" fill="${INK}"/>${grid()}`),
  },
  { file: 'assets/images/android-icon-foreground.png', size: 1024, draw: (m) => svg(viewBox('scene'), glyph(m)) },
  // Android tints the monochrome layer itself; only its alpha counts.
  { file: 'assets/images/android-icon-monochrome.png', size: 1024, draw: (m) => svg(viewBox('scene'), glyph(m)) },
  // Splash and favicon sit on the page colour, so they carry their own rounded corners.
  { file: 'assets/images/splash-icon.png', size: 1024, draw: (m) => badge(m, { rounded: true }) },
  { file: 'assets/images/favicon.png', size: 48, draw: (m) => badge(m, { rounded: true }) },
];

function fontFace() {
  const require = createRequire(import.meta.url);
  const font = require.resolve('@expo-google-fonts/be-vietnam-pro/700Bold/BeVietnamPro_700Bold.ttf');
  const data = readFileSync(font).toString('base64');
  return `@font-face{font-family:"Be Vietnam Pro";font-weight:700;src:url(data:font/ttf;base64,${data}) format("truetype")}`;
}

/** @param {import('@playwright/test').Page} page @param {string} body @param {number} size */
async function load(page, body, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><style>${fontFace()}html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}</style>${body}`,
  );
  const loaded = await page.evaluate(async () => {
    await document.fonts.load('700 100px "Be Vietnam Pro"');
    return document.fonts.check('700 100px "Be Vietnam Pro"');
  });
  if (!loaded) throw new Error('Be Vietnam Pro 700 did not load');
}

/** @param {import('@playwright/test').Page} page @returns {Promise<Metrics>} */
async function measure(page) {
  await load(page, '<canvas></canvas>', 16);
  return page.evaluate(() => {
    const context = /** @type {CanvasRenderingContext2D} */ (document.querySelector('canvas')?.getContext('2d'));
    context.font = '700 1000px "Be Vietnam Pro"';
    const ink = context.measureText('a');
    return { ascent: ink.actualBoundingBoxAscent, left: -ink.actualBoundingBoxLeft, right: ink.actualBoundingBoxRight };
  });
}

/** @param {string} file @returns {string} */
const dataUrl = (file) => `data:image/png;base64,${readFileSync(join(ROOT, file)).toString('base64')}`;

/**
 * Screenshots of the rendered files as people meet them: the splash on the
 * light and dark page colours (expo-splash-screen centres it at imageWidth,
 * 160 dp), and at 192 and 48 px the iOS icon, the Android adaptive icon in a
 * circle mask and the themed (monochrome) icon.
 * @param {import('@playwright/test').Page} page @param {string} dir
 */
async function preview(page, dir) {
  mkdirSync(dir, { recursive: true });
  /** @param {string} name @param {number} width @param {number} height @param {string} body */
  const shoot = async (name, width, height, body) => {
    await page.setViewportSize({ width, height });
    await page.setContent(`<!doctype html><style>body{margin:0}</style>${body}`);
    await page.screenshot({ path: join(dir, name) });
    console.log(join(dir, name));
  };
  for (const [scheme, background] of [['light', '#F3F6F4'], ['dark', '#121816']]) {
    await shoot(`splash-${scheme}.png`, 390, 844,
      `<div style="height:844px;background:${background};display:grid;place-items:center"><img src="${dataUrl('assets/images/splash-icon.png')}" width="160"></div>`);
  }
  for (const px of [192, 48]) {
    // A launcher shows the centre 72 of the 108 dp layers.
    const layer = `position:absolute;inset:-25%;width:150%;height:150%`;
    const tile = `position:relative;width:${px}px;height:${px}px;overflow:hidden`;
    const body = `<div style="display:flex;gap:${px / 4}px;padding:${px / 4}px;background:#DDE3E0">
      <img style="${tile};border-radius:22%" src="${dataUrl('assets/images/icon.png')}">
      <div style="${tile};border-radius:50%"><img style="${layer}" src="${dataUrl('assets/images/android-icon-background.png')}"><img style="${layer}" src="${dataUrl('assets/images/android-icon-foreground.png')}"></div>
      <div style="${tile};border-radius:50%;background:#E8DEF8"><div style="${layer};background:#4A3880;-webkit-mask:url(${dataUrl('assets/images/android-icon-monochrome.png')}) center/contain no-repeat"></div></div>
      <img style="width:${px}px;height:${px}px" src="${dataUrl('assets/images/favicon.png')}"></div>`;
    await shoot(`icons-${px}.png`, px * 4 + (px / 4) * 5, px + px / 2, body);
  }
}

/** Renders every artwork into the repo; with `previewDir`, also screenshots of them in use. @param {string} [previewDir] */
async function render(previewDir) {
  const { chromium } = await import('@playwright/test');
  // Grey anti-aliasing: LCD subpixel text would leave coloured fringes in the small favicon.
  const browser = await chromium.launch({ args: ['--disable-lcd-text'] });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const metrics = await measure(page);
    for (const art of ARTWORK) {
      await load(page, art.draw(metrics), art.size);
      const path = join(ROOT, art.file);
      mkdirSync(dirname(path), { recursive: true });
      await page.screenshot({ path, omitBackground: true });
      console.log(`${art.file} ${art.size}px`);
    }
    if (previewDir) await preview(page, previewDir);
  } finally {
    await browser.close();
  }
}

if (import.meta.main) {
  const previewAt = process.argv.indexOf('--preview');
  await render(previewAt === -1 ? undefined : process.argv[previewAt + 1]);
}
