'use strict';

/**
 * Regenerates the whole favicon set, and favicon.ico, from one source image:
 * assets/images/avatar.jpg — the same photo the header and the share card use.
 *
 *   npm run favicons
 *
 * Before this, the icons were a set of PNGs cut by hand from the illustrated
 * avatar in 2022 and committed once. There was nothing tying them to the
 * avatar, so changing one meant remembering to re-cut eleven files at the right
 * eleven sizes. Now the source is the master and everything else is derived.
 *
 * `sips` does the resampling: it ships with macOS, so this needs no image
 * dependency in package.json. The .ico is assembled here, because sips cannot
 * write one — see writeIco below.
 *
 * NOT regenerated: assets/images/favicon/safari-pinned-tab.svg. That is a
 * one-bit vector mask which Safari fills with a single flat colour for pinned
 * tabs, so a photograph cannot become one; it is still the shape cut from the
 * old illustration.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);

const SOURCE = 'assets/images/avatar.jpg';
const OUT_DIR = 'assets/images/favicon';
const ICO_PATH = 'favicon.ico';

// The square icons, by filename and edge length. These are exactly the sizes
// the layout, site.webmanifest and browserconfig.xml ask for; adding one here
// without referencing it somewhere just ships a file nobody fetches.
const SQUARE_ICONS = [
    ['favicon-16x16.png', 16],
    ['favicon-32x32.png', 32],
    ['mstile-70x70.png', 70],
    ['mstile-144x144.png', 144],
    ['mstile-150x150.png', 150],
    ['apple-touch-icon.png', 180],
    ['android-chrome-192x192.png', 192],
    ['mstile-310x310.png', 310],
    ['android-chrome-512x512.png', 512],
];

// The one non-square tile. Windows renders it wide, so the photo is scaled to
// the tile's height and padded out to its width rather than stretched.
const WIDE_TILE = { name: 'mstile-310x150.png', width: 310, height: 150 };

// The pad behind the wide Windows tile: the palette's light background, so the
// tile cannot end up showing two different grounds. `sips --padColor` wants
// bare hex, without the leading '#'.
const PAD_COLOUR = JSON.parse(await readFile('_data/colours.json', 'utf8')).light.bg.replace('#', '');

// The sizes that go inside favicon.ico. 48 is included because Windows uses it
// for desktop shortcuts and the taskbar; browsers take the 16 or the 32.
const ICO_SIZES = [16, 32, 48];

/**
 * Resizes the source into a square PNG of the given edge length.
 *
 * `-z h w` is sips' resample, which fits the image to the box; the source is
 * square so nothing is cropped.
 *
 * @param {String} out
 * @param {Number} size
 */
async function square(out, size) {
    await run('sips', ['-s', 'format', 'png', '-z', String(size), String(size), SOURCE, '--out', out]);
}

/**
 * Builds an .ico from PNGs already on disk.
 *
 * The format is a 6-byte header, then one 16-byte directory entry per image,
 * then the image payloads. The payloads here are PNGs rather than the older
 * BMP-with-AND-mask encoding: every browser in use reads PNG-in-ICO, and it
 * avoids hand-rolling a bitmap encoder for an icon nobody looks at closely.
 *
 * A dimension of 256 or more is written as 0, which is what the format uses to
 * mean "256 or larger" — not reachable from ICO_SIZES today, but the encoding
 * is wrong rather than merely unused if it is left out.
 *
 * @param {String}         path
 * @param {Array<Buffer>}  pngs
 * @param {Array<Number>}  sizes
 */
async function writeIco(path, pngs, sizes) {
    const count = pngs.length;
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);      // reserved
    header.writeUInt16LE(1, 2);      // 1 = icon
    header.writeUInt16LE(count, 4);

    const directory = Buffer.alloc(16 * count);
    let offset = header.length + directory.length;

    pngs.forEach((png, i) => {
        const at = i * 16;
        const dimension = sizes[i] >= 256 ? 0 : sizes[i];
        directory.writeUInt8(dimension, at);          // width
        directory.writeUInt8(dimension, at + 1);      // height
        directory.writeUInt8(0, at + 2);              // palette size (0 = none)
        directory.writeUInt8(0, at + 3);              // reserved
        directory.writeUInt16LE(1, at + 4);           // colour planes
        directory.writeUInt16LE(32, at + 6);          // bits per pixel
        directory.writeUInt32LE(png.length, at + 8);  // payload length
        directory.writeUInt32LE(offset, at + 12);     // payload offset
        offset += png.length;
    });

    await writeFile(path, Buffer.concat([header, directory, ...pngs]));
}

async function main() {
    await mkdir(OUT_DIR, { recursive: true });

    for (const [name, size] of SQUARE_ICONS) {
        await square(`${OUT_DIR}/${name}`, size);
        console.log(`Wrote ${OUT_DIR}/${name} (${size}x${size})`);
    }

    // Scale to the tile's height first, then pad out to its width.
    const wide = `${OUT_DIR}/${WIDE_TILE.name}`;
    await square(wide, WIDE_TILE.height);
    await run('sips', [
        '-p', String(WIDE_TILE.height), String(WIDE_TILE.width),
        '--padColor', PAD_COLOUR,
        wide, '--out', wide,
    ]);
    console.log(`Wrote ${wide} (${WIDE_TILE.width}x${WIDE_TILE.height})`);

    // favicon.ico, from temporary PNGs at the three sizes it carries.
    const temporary = [];
    const pngs = [];
    for (const size of ICO_SIZES) {
        const path = `${OUT_DIR}/.ico-${size}.png`;
        await square(path, size);
        temporary.push(path);
        pngs.push(await readFile(path));
    }
    await writeIco(ICO_PATH, pngs, ICO_SIZES);
    await Promise.all(temporary.map((path) => unlink(path)));
    console.log(`Wrote ${ICO_PATH} (${ICO_SIZES.join(', ')})`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
