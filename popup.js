document.addEventListener("DOMContentLoaded", async () => {
    const input = document.getElementById("siteInput");
    const toggleBtn = document.getElementById("toggleBtn");
    const saveBtn = document.getElementById("saveBtn");
    const enableBtn = document.getElementById("enableBtn");
    const closeWindow = document.getElementById("closeWindow");

    let currentDomain = "";
    let isEnabled = true;

    const storage = await chrome.storage.sync.get([
        "excludedDomains",
        "enabled"
    ]);

    let excludedDomains = Array.isArray(storage.excludedDomains)
        ? storage.excludedDomains
        : [];

    isEnabled = storage.enabled !== false;

    const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (tabs[0]?.url) {
        try {
            currentDomain = new URL(tabs[0].url).hostname;
        } catch {
            currentDomain = "";
        }
    }

    input.textContent = excludedDomains.join("\n");

    updateEnableButton();
    updateToggleButton();
    applyCommentStyling(input);

    closeWindow.addEventListener("click", () => {
        window.close();
    });

    input.addEventListener("input", () => {
        input.classList.remove("invalid", "valid");
        applyCommentStyling(input);
    });

    toggleBtn.addEventListener("click", () => {
        if (!currentDomain) {
            pulse(toggleBtn, "pulse-red");
            return;
        }

        if (excludedDomains.includes(currentDomain)) {
            excludedDomains = excludedDomains.filter(
                domain => domain !== currentDomain
            );

            removeLine(currentDomain);
        } else {
            excludedDomains.push(currentDomain);

            const currentText = input.innerText.trim();

            input.textContent = currentText
                ? `${currentText}\n${currentDomain}`
                : currentDomain;
        }

        applyCommentStyling(input);
        updateToggleButton();
        pulse(toggleBtn, "pulse-white");
    });

    saveBtn.addEventListener("click", async () => {
        const result = parseInput();

        if (!result.valid) {
            input.classList.remove("valid");
            input.classList.add("invalid");
            pulse(saveBtn, "pulse-red");

            setTimeout(() => {
                input.classList.remove("invalid");
            }, 500);

            return;
        }

        excludedDomains = result.domains;

        await chrome.storage.sync.set({
            excludedDomains
        });

        input.classList.remove("invalid");
        input.classList.add("valid");

        pulse(saveBtn, "pulse-green");
        updateToggleButton();

        setTimeout(() => {
            input.classList.remove("valid");
        }, 500);

        reloadCurrentTab();
    });

    enableBtn.addEventListener("click", async () => {
        isEnabled = !isEnabled;

        await chrome.storage.sync.set({
            enabled: isEnabled
        });

        updateEnableButton();

        pulse(
            enableBtn,
            isEnabled ? "pulse-green" : "pulse-red"
        );

        reloadCurrentTab();
    });

    function getLines() {
        return input.innerText
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);
    }

    function parseInput() {
        const lines = input.innerText.split("\n");
        const domains = [];

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith("!")) {
                continue;
            }

            const domain = normalizeDomain(trimmed);

            if (!domain) {
                return {
                    valid: false,
                    domains: []
                };
            }

            domains.push(domain);
        }

        return {
            valid: true,
            domains: [...new Set(domains)]
        };
    }

    function normalizeDomain(value) {
        let domain = value.trim();

        if (!domain) {
            return null;
        }

        // Full URL.
        if (/^https?:\/\//i.test(domain)) {
            try {
                const url = new URL(domain);

                if (!url.hostname) {
                    return null;
                }

                return url.hostname.toLowerCase();
            } catch {
                return null;
            }
        }

        // Reject other schemes.
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(domain)) {
            return null;
        }

        // Remove a leading www. only when the user explicitly entered it.
        domain = domain.toLowerCase();

        // Remove accidental trailing dots.
        domain = domain.replace(/\.+$/, "");

        // Basic hostname validation.
        if (
            domain.length > 253 ||
            domain.includes("/") ||
            domain.includes(" ") ||
            domain.includes(":")
        ) {
            return null;
        }

        const labels = domain.split(".");

        if (
            labels.length < 2 ||
            labels.some(
                label =>
                    !label ||
                    label.length > 63 ||
                    !/^[a-z0-9-]+$/i.test(label) ||
                    label.startsWith("-") ||
                    label.endsWith("-")
            )
        ) {
            return null;
        }

        return domain;
    }

    function removeLine(domain) {
        const lines = input.innerText
            .split("\n")
            .filter(line => {
                const trimmed = line.trim();

                if (!trimmed || trimmed.startsWith("!")) {
                    return true;
                }

                return normalizeDomain(trimmed) !== domain;
            });

        input.textContent = lines.join("\n");
    }

    function updateToggleButton() {
        if (!currentDomain) {
            toggleBtn.textContent = "Add site to list";
            return;
        }

        toggleBtn.textContent = excludedDomains.includes(currentDomain)
            ? "Remove site from list"
            : "Add site to list";
    }

    function updateEnableButton() {
        enableBtn.textContent = isEnabled
            ? "Enabled"
            : "Disabled";
    }

    function applyCommentStyling(element) {
        const text = element.innerText;
        const lines = text.split("\n");

        const selection = window.getSelection();
        let cursorPosition = 0;

        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const preRange = range.cloneRange();

            preRange.selectNodeContents(element);
            preRange.setEnd(
                range.startContainer,
                range.startOffset
            );

            cursorPosition = preRange.toString().length;
        }

        element.innerHTML = lines
            .map(line => {
                if (line.trim().startsWith("!")) {
                    return `<span class="comment-line">${escapeHtml(line)}</span>`;
                }

                return escapeHtml(line);
            })
            .join("\n");

        restoreCursor(element, cursorPosition);
    }

    function restoreCursor(element, position) {
        const range = document.createRange();
        const selection = window.getSelection();

        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT
        );

        let offset = 0;

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const length = node.textContent.length;

            if (offset + length >= position) {
                range.setStart(node, position - offset);
                range.collapse(true);

                selection.removeAllRanges();
                selection.addRange(range);
                return;
            }

            offset += length;
        }

        range.selectNodeContents(element);
        range.collapse(false);

        selection.removeAllRanges();
        selection.addRange(range);
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function pulse(button, className) {
        button.classList.remove(
            "pulse-white",
            "pulse-red",
            "pulse-green"
        );

        void button.offsetWidth;

        button.classList.add(className);

        setTimeout(() => {
            button.classList.remove(className);
        }, 500);
    }

    async function reloadCurrentTab() {
        if (!tabs[0]?.id) {
            return;
        }

        try {
            await chrome.tabs.reload(tabs[0].id);
        } catch {
            // Browser-restricted pages cannot be reloaded by the extension.
        }
    }
});