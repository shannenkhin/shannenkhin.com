'use strict';

/**
 * Regenerates assets/docs/shannen-khin-cv.pdf by printing the built CV page.
 *
 * The header's "Download CV" link points at that file. Generating it from the
 * page means the two cannot disagree: add a role to a collection, rebuild, run
 * this, and the PDF has the role. A hand-made PDF dropped into assets/docs
 * would start drifting from the site the first time anything changed.
 *
 * Run `bundle exec jekyll build` first; this prints `_site`, not the live site.
 *
 *   npm run cv:pdf
 *
 * Chrome's own print is the renderer, so the layout comes entirely from the
 * print rules in _sass/print.scss and the `@page` block in assets/css/cv.scss —
 * including the A4 size and the "page N of M" margin box, which needs a
 * Chromium new enough to support paged-media margin boxes.
 */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const PORT = 8091;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'assets/docs/shannen-khin-cv.pdf';

/**
 * Serves the built site so the page loads over http rather than file://, which
 * would break every root-relative asset path.
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
 * Rewrites every root-relative link to an absolute production URL, so a link
 * followed out of the PDF reaches shannenkhin.com rather than the localhost it
 * was printed from. Chrome bakes the DOM's resolved hrefs into the PDF's link
 * annotations, so this has to happen before printing, not after.
 *
 * The origin comes from the page's own og:url — which Jekyll renders from `url`
 * in _config.yml — so there is no second copy of the domain to keep in step.
 *
 * @param {import('playwright').Page} page
 *
 * @returns {Promise<{origin: String, rewritten: Array<String>}>}
 */
async function absolutiseLinks(page) {
    return page.evaluate(() => {
        const ogUrl = document.querySelector('meta[property="og:url"]')?.content;
        if (!ogUrl) {
            throw new Error('No og:url on the page — cannot resolve the production origin');
        }

        const { origin } = new URL(ogUrl);
        const rewritten = [];

        for (const anchor of document.querySelectorAll('a[href]')) {
            const href = anchor.getAttribute('href');
            const absolute = new URL(href, origin).href;
            if (absolute !== href) {
                anchor.setAttribute('href', absolute);
                rewritten.push(`${href} -> ${absolute}`);
            }
        }

        return { origin, rewritten };
    });
}

async function main() {
    const server = await startServer();
    const browser = await chromium.launch();

    try {
        const page = await browser.newPage();
        await page.goto(`${BASE}/`, { waitUntil: 'load' });

        await page.emulateMedia({ media: 'print', colorScheme: 'light' });
        await page.evaluate(() => document.fonts && document.fonts.ready);

        const { origin, rewritten } = await absolutiseLinks(page);
        console.log(`Absolute origin: ${origin}`);
        rewritten.forEach((line) => console.log(`  ${line}`));

        await mkdir(dirname(OUT), { recursive: true });
        await page.pdf({
            path: OUT,
            preferCSSPageSize: true,   // honour `@page { size: a4 portrait }` from cv.scss
            printBackground: true,
        });
        console.log(`Wrote ${OUT}`);
    } finally {
        await browser.close();
        server.kill();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
