'use strict';

/**
 * Regenerates assets/images/og-card.png, the 1200x630 card LinkedIn, Slack,
 * WhatsApp and the rest render when someone shares a link to the site.
 *
 * og:image used to point at android-chrome-512x512.png — the favicon. It is
 * square, so every unfurl cropped or letterboxed it into a thumbnail, and the
 * twitter:image:alt beside it described it as a photo of Shannen, which it was
 * not. This draws a real card at the 1.91:1 aspect ratio the scrapers want.
 *
 * Run `bundle exec jekyll build` first; the card pulls the avatar photo and
 * the webfont from `_site`, so it renders in the same faces the site does.
 *
 * The avatar is a 160x160 source drawn here at 300x300, so it is upscaled and
 * a little soft. That is the largest LinkedIn's CDN will serve for this
 * profile; replace assets/images/avatar.jpg with a bigger original and rerun
 * this and `npm run favicons` to sharpen every surface at once.
 *
 *   npm run og:image
 *
 * Deliberately a build step with a committed output rather than something
 * generated in CI: the scrapers fetch it from the live site, so it has to exist
 * as a static file, and keeping it in git means a change to it shows up in a
 * diff like any other asset.
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const PORT = 8092;
const BASE = `http://127.0.0.1:${PORT}`;

/**
 * Reads one top-level scalar out of _config.yml.
 *
 * The path, the dimensions and the strings on the card are read from the config
 * rather than repeated here, because the layout renders og:image:width/height
 * from the same keys and the scrapers lay the card out from those tags before
 * the image has finished downloading. If the two drifted, every unfurl would
 * reserve the wrong box for the picture, and nothing in the build would notice.
 *
 * A deliberately small reader rather than a YAML dependency: these keys are
 * quoted scalars at the top level, and a wrong or missing one throws here
 * rather than rendering a card at some silently different size.
 *
 * @param {String} yaml
 * @param {String} key
 *
 * @returns {String}
 */
function configValue(yaml, key) {
    const match = yaml.match(new RegExp(`^${key}:\\s*'?"?([^'"\\n]+)'?"?\\s*$`, 'm'));
    if (!match) {
        throw new Error(`_config.yml has no ${key} — the layout renders the share card from it, so it must be set`);
    }

    return match[1].trim();
}

const config = await readFile('_config.yml', 'utf8');

// Jekyll serves site_og_image at the site root; strip the leading slash to get
// the repository path to write.
const OUT = configValue(config, 'site_og_image').replace(/^\//, '');
const WIDTH = Number(configValue(config, 'site_og_image_width'));
const HEIGHT = Number(configValue(config, 'site_og_image_height'));
const FIRST_NAME = configValue(config, 'header_firstname');
const LAST_NAME = configValue(config, 'header_lastname');
const JOB_TITLE = configValue(config, 'header_job_title');
const LOCATION = configValue(config, 'header_location');

if (!Number.isInteger(WIDTH) || !Number.isInteger(HEIGHT) || WIDTH < 1 || HEIGHT < 1) {
    throw new Error(`site_og_image_width/height must be positive integers, got ${WIDTH}x${HEIGHT}`);
}

/**
 * Serves the built site so the card's font and avatar URLs resolve over http.
 *
 * @returns {Promise<import('node:child_process').ChildProcess>}
 */
async function startServer() {
    const server = spawn('npx', ['http-server', '_site', '-p', String(PORT), '-s', '-c-1'], { stdio: 'ignore' });
    for (let i = 0; i < 50; i++) {
        try {
            const res = await fetch(`${BASE}/`);
            if (res.ok) {
                return server;
            }
        } catch {
            // not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    server.kill();
    throw new Error(`Static server did not start on ${BASE}`);
}

/**
 * The card itself. Absolute localhost URLs throughout because this is loaded via
 * setContent, which has no document base to resolve relative paths against.
 *
 * Colours and faces are the site's light theme, hard-coded rather than read from
 * the stylesheet: an OG card is rendered by a scraper that has no colour scheme
 * and no CSS custom properties, so there is nothing here for a token to vary.
 * The name is set in Georgia and lowercased, the way the site's header sets it.
 *
 * @returns {String}
 */
function cardHtml() {
    return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<style>
    @font-face {
        font-family: WebSans;
        src: url('${BASE}/assets/fonts/poppins.woff2') format('woff2');
        font-weight: normal;
    }
    @font-face {
        font-family: WebSans;
        src: url('${BASE}/assets/fonts/poppins-bold.woff2') format('woff2');
        font-weight: bold;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
        align-items: center;
        background: #fff;
        color: #595959;
        display: flex;
        font-family: 'WebSans', sans-serif;
        gap: 64px;
        height: ${HEIGHT}px;
        padding: 0 88px;
        width: ${WIDTH}px;
    }

    /* The navy ring the site's header avatar wears, scaled up for a card this
       size. */
    .avatar {
        border: 12px solid #25285b;
        border-radius: 50%;
        flex: none;
        height: 300px;
        object-fit: cover;
        width: 300px;
    }

    .name {
        color: #25285b;
        font-family: Georgia, 'Times New Roman', Times, serif;
        font-size: 86px;
        line-height: 1.05;
        margin-bottom: 26px;
    }

    /* The surname in the header's lighter grey, as on the site. */
    .name .alternate { color: #7f7f7f; }

    .title { color: #404040; font-size: 40px; font-weight: bold; margin-bottom: 12px; }

    .location { color: #595959; font-size: 32px; margin-bottom: 40px; }

    /* A rule rather than a box, so the domain reads as a footer to the block
       above it instead of a second, competing element. */
    .domain {
        border-top: 3px solid #cecece;
        color: #25285b;
        font-size: 30px;
        font-weight: bold;
        padding-top: 26px;
    }
</style>
</head>
<body>
    <img class="avatar" src="${BASE}/assets/images/avatar.jpg" alt="">
    <div>
        <div class="name">${FIRST_NAME} <span class="alternate">${LAST_NAME}</span></div>
        <div class="title">${JOB_TITLE}</div>
        <div class="location">${LOCATION}</div>
        <div class="domain">shannenkhin.com</div>
    </div>
</body>
</html>`;
}

async function main() {
    const server = await startServer();
    const browser = await chromium.launch();

    try {
        const page = await browser.newPage({
            viewport: { width: WIDTH, height: HEIGHT },
            // The scrapers serve one file to every screen, so render it at 1x
            // and let each of them scale it. A 2x card would be four times the
            // bytes for a picture most clients show at well under 600px wide.
            deviceScaleFactor: 1,
        });

        await page.setContent(cardHtml(), { waitUntil: 'load' });
        // Without this the card can shoot before the webfont swaps in, and the
        // job title renders in the sans fallback rather than Poppins.
        await page.evaluate(() => document.fonts.ready);

        await mkdir(dirname(OUT), { recursive: true });
        await page.screenshot({ path: OUT, type: 'png' });
        console.log(`Wrote ${OUT} (${WIDTH}x${HEIGHT})`);
    } finally {
        await browser.close();
        server.kill();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
