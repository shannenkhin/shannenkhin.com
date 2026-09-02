'use strict';

// The visitor's colour-theme preference, persisted in localStorage.
//
//  - 'auto'  follow the operating system (the default; no override)
//  - 'light' force the light theme
//  - 'dark'  force the dark theme
//
// A forced theme is applied by setting `data-theme` on <html>; 'auto' clears it
// so the prefers-color-scheme media query takes back over. The stylesheet reads
// both (see the theme token blocks in global.scss). The same key is read by the
// tiny classic theme-init.js in the page <head>, which applies the saved theme
// before first paint to avoid a flash of the wrong one.

export const THEME_STORAGE_KEY = 'theme';
export const THEME_AUTO = 'auto';
export const THEME_LIGHT = 'light';
export const THEME_DARK = 'dark';

// The recognised themes (used to validate stored/incoming values). The toggle
// cycle order is decided at tap time by Theme.next, not by this array.
export const THEMES = [THEME_AUTO, THEME_LIGHT, THEME_DARK];

const LABELS = {
    [THEME_AUTO]: 'Auto',
    [THEME_LIGHT]: 'Light',
    [THEME_DARK]: 'Dark',
};

// Kept as text glyphs so the toggle needs no extra icon assets: a half-filled
// circle for auto, a sun for light, a moon for dark.
const GLYPHS = {
    [THEME_AUTO]: '◐',
    [THEME_LIGHT]: '☀',
    [THEME_DARK]: '☾',
};

const ARIA_LABEL_TEMPLATE = 'Colour theme: {label}. Activate to change it.';

export default class Theme {
    /**
     * The saved preference, defaulting to 'auto' when nothing valid is stored
     * (including when localStorage is unavailable, e.g. private browsing).
     *
     * @returns {String}
     */
    static get() {
        let stored;
        try {
            stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        } catch (e) {
            stored = null;
        }

        return THEMES.includes(stored) ? stored : THEME_AUTO;
    }

    /**
     * Persists and applies a theme, coercing anything unrecognised to 'auto'.
     * Storage failures are ignored — the theme still applies for this visit.
     *
     * @param {String} theme
     *
     * @returns {String} the theme actually applied
     */
    static set(theme) {
        const value = THEMES.includes(theme) ? theme : THEME_AUTO;
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, value);
        } catch (e) {
            // Ignore: a forced theme that can't be saved still applies below.
        }
        Theme.apply(value);

        return value;
    }

    /**
     * Reflects a theme onto <html>: a forced theme sets `data-theme`, 'auto'
     * removes it so the OS preference governs again.
     *
     * @param {String} theme
     */
    static apply(theme) {
        const root = document.documentElement;
        if (theme === THEME_LIGHT || theme === THEME_DARK) {
            root.setAttribute('data-theme', theme);
        } else {
            root.removeAttribute('data-theme');
        }
    }

    /**
     * Whether the operating system currently prefers a dark colour scheme.
     *
     * @returns {Boolean}
     */
    static prefersDark() {
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /**
     * The next theme in the toggle cycle. From Auto the first tap always goes
     * to the theme opposite what the OS is currently showing (so it's a visible
     * change), then to the theme matching the OS, then back to Auto:
     *
     *   OS light:  Auto → Dark → Light → Auto
     *   OS dark:   Auto → Light → Dark → Auto
     *
     * @param {String} theme
     *
     * @returns {String}
     */
    static next(theme) {
        const opposite = Theme.prefersDark() ? THEME_LIGHT : THEME_DARK;
        const matching = Theme.prefersDark() ? THEME_DARK : THEME_LIGHT;

        if (theme === THEME_AUTO) {
            return opposite;
        }
        if (theme === opposite) {
            return matching;
        }

        return THEME_AUTO;
    }

    /**
     * @param {String} theme
     *
     * @returns {String}
     */
    static label(theme) {
        return LABELS[theme] || LABELS[THEME_AUTO];
    }

    /**
     * @param {String} theme
     *
     * @returns {String}
     */
    static glyph(theme) {
        return GLYPHS[theme] || GLYPHS[THEME_AUTO];
    }

    /**
     * Wires the toggle button to cycle the theme on click, keeping its glyph,
     * label and accessible name in sync, and reveals it (it ships hidden so it
     * never appears as a dead control when JavaScript is unavailable). A missing
     * button is a no-op.
     *
     * @param {HTMLButtonElement|null} button
     */
    static bindToggle(button) {
        if (!button) {
            return;
        }

        const render = (theme) => {
            const label = Theme.label(theme);
            button.textContent = `${Theme.glyph(theme)} ${label}`;
            button.setAttribute('aria-label', ARIA_LABEL_TEMPLATE.replace('{label}', label));
        };

        render(Theme.get());
        button.hidden = false;
        button.addEventListener('click', () => {
            render(Theme.set(Theme.next(Theme.get())));
        });
    }
}
