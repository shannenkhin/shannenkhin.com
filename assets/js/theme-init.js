'use strict';

// Applies the saved colour theme before the stylesheets paint, so a visitor who
// forced light or dark never sees a flash of the other one. Deliberately a
// tiny, dependency-free classic script (not a module): it must run render-
// blocking in the <head> ahead of the CSS, before the deferred module scripts.
// It mirrors Theme.apply/Theme.get in assets/js/Theme.js; keep the storage key
// and values in step.
(function () {
    try {
        var theme = window.localStorage.getItem('theme');
        if (theme === 'light' || theme === 'dark') {
            document.documentElement.setAttribute('data-theme', theme);
        }
    } catch (e) {
        // No stored preference (or no storage) — fall through to the OS setting.
    }
})();
