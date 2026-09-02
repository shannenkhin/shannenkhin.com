'use strict';

// The site's only JavaScript. Everything the page needs to read is in the HTML;
// this adds the colour-theme toggle and nothing else.

import Theme from './Theme.js';

// Header colour-theme toggle (Auto → Light → Dark). The saved choice was
// already applied pre-paint by theme-init.js in the <head>; this reveals the
// button and wires the cycle.
Theme.bindToggle(document.getElementById('theme-toggle'));
