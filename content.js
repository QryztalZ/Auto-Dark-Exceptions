(() => {
    "use strict";

    const lightCSS = `
        :root {
            color-scheme: light only !important;
        }
    `;

    function applyStyle(excludedDomains, enabled) {
        if (!enabled) {
            return;
        }

        const currentDomain = window.location.hostname;

        const isExcluded = excludedDomains.some(domain =>
            currentDomain === domain ||
            currentDomain.endsWith("." + domain)
        );

        if (!isExcluded) {
            return;
        }

        const style = document.createElement("style");
        style.id = "auto-dark-exceptions-style";
        style.textContent = lightCSS;

        (document.head || document.documentElement).appendChild(style);
    }

    chrome.storage.sync.get(
        ["excludedDomains", "enabled"],
        result => {
            const excludedDomains = Array.isArray(result.excludedDomains)
                ? result.excludedDomains
                : [];

            const enabled = result.enabled !== false;

            applyStyle(excludedDomains, enabled);
        }
    );
})();