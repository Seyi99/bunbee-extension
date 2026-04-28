// ─── Bunbee content script ────────────────────────────────────────────────────
// Injects a panel below each review card showing mnemonics and a sentence
// generator for the current subject.

const BUNBEE_API = "https://api.bunbee.cc";
const BUNBEE_WEB = "https://bunbee.cc";
const PANEL_ID = "bunbee-panel";

// ─── Icons (Material Symbols Rounded, inlined as SVG) ────────────────────────
// We bundle the icon paths as inline SVG instead of loading the Material
// Symbols web font. WaniKani's CSP (`font-src`, `style-src 'self'`) blocks
// remote fonts and inline @font-face rules, and MV3 popups have a strict
// default CSP that disallows fonts.googleapis.com. Inline SVG bypasses both:
// no external request, no inline <style>, just shape data in the DOM.
//
// All paths come from Google's Material Symbols Rounded set (Apache 2.0).
// Most use the modern 960x960 grid (viewBox "0 -960 960 960"); a couple
// (auto_awesome) come from the older 24x24 release.
const ICONS = {
    psychology: { vb: "0 -960 960 960", d: "m446-418 2 30q.74 6.22 4.78 10.11 4.05 3.89 9.94 3.89h32.39q5.89 0 10.02-3.89 4.12-3.89 4.87-10.11l2-30q12-2 22.47-8.46Q544.94-432.92 553-441l30 10q5 2 10 0t7.8-6.85l15.4-26.3q2.8-4.85 2.3-9.85t-5.19-9.17L593-499q5-14 5-29t-5-29l20.31-15.83Q618-577 618.5-582t-2.3-9.85l-15.4-26.3Q598-623 593-625t-10 0l-30 10q-8.33-7.69-19.17-13.85Q523-635 512-638l-2-30q-.74-6.22-4.78-10.11-4.05-3.89-9.94-3.89h-32.39q-5.89 0-10.01 3.89-4.13 3.89-4.88 10.11l-2 30q-11 3-21.83 9.15Q413.33-622.69 405-615l-30-10q-5-2-10 0t-7.8 6.85l-15.4 26.3Q339-587 339.5-582t5.19 9.17L365-557q-5 14-5 29t5 29l-20.31 15.83Q340-479 339.5-474t2.3 9.85l15.4 26.3Q360-433 365-431t10 0l30-10q8.06 8.08 18.53 14.54Q434-420 446-418Zm-16.5-60.38q-20.5-20.38-20.5-49.5t20.38-49.62q20.38-20.5 49.5-20.5t49.62 20.38q20.5 20.38 20.5 49.5t-20.38 49.62q-20.38 20.5-49.5 20.5t-49.62-20.38ZM240-252q-57-52-88.5-121.5T120-520q0-150 105-255t255-105q125 0 221.5 73.5T827-615l55 218q4 14-5 25.5T853-360h-93v140q0 24.75-17.62 42.37Q724.75-160 700-160H600v50q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63Q540-97.25 540-110v-80q0-12.75 8.63-21.38Q557.25-220 570-220h130v-170q0-12.75 8.63-21.38Q717.25-420 730-420h84l-45-180q-24-97-105-158.5T480-820q-125 0-212.5 86.5T180-522.46q0 64.42 26.32 122.39Q232.65-342.09 281-297l19 18v169q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63Q240-97.25 240-110v-142Zm257-198Z" },
    auto_awesome: { vb: "0 0 24 24", d: "M19 8.3q-.125 0-.262-.075Q18.6 8.15 18.55 8l-.8-1.75-1.75-.8q-.15-.05-.225-.188Q15.7 5.125 15.7 5t.075-.263Q15.85 4.6 16 4.55l1.75-.8.8-1.75q.05-.15.188-.225.137-.075.262-.075t.263.075q.137.075.187.225l.8 1.75 1.75.8q.15.05.225.187.075.138.075.263t-.075.262Q22.15 5.4 22 5.45l-1.75.8-.8 1.75q-.05.15-.187.225-.138.075-.263.075Zm0 14q-.125 0-.262-.075-.138-.075-.188-.225l-.8-1.75-1.75-.8q-.15-.05-.225-.188-.075-.137-.075-.262t.075-.262q.075-.138.225-.188l1.75-.8.8-1.75q.05-.15.188-.225.137-.075.262-.075t.263.075q.137.075.187.225l.8 1.75 1.75.8q.15.05.225.188.075.137.075.262t-.075.262q-.075.138-.225.188l-1.75.8-.8 1.75q-.05.15-.187.225-.138.075-.263.075ZM9 18.575q-.275 0-.525-.15T8.1 18l-1.6-3.5L3 12.9q-.275-.125-.425-.375-.15-.25-.15-.525t.15-.525q.15-.25.425-.375l3.5-1.6L8.1 6q.125-.275.375-.425.25-.15.525-.15t.525.15q.25.15.375.425l1.6 3.5 3.5 1.6q.275.125.425.375.15.25.15.525t-.15.525q-.15.25-.425.375l-3.5 1.6L9.9 18q-.125.275-.375.425-.25.15-.525.15Z" },
    keyboard_arrow_up: { vb: "0 -960 960 960", d: "M480-554 304-378q-9 9-21 8.5t-21-9.5q-9-9-9-21.5t9-21.5l197-197q9-9 21-9t21 9l198 198q9 9 9 21t-9 21q-9 9-21.5 9t-21.5-9L480-554Z" },
    keyboard_arrow_down: { vb: "0 -960 960 960", d: "M469-358q-5-2-10-7L261-563q-9-9-8.5-21.5T262-606q9-9 21.5-9t21.5 9l175 176 176-176q9-9 21-8.5t21 9.5q9 9 9 21.5t-9 21.5L501-365q-5 5-10 7t-11 2q-6 0-11-2Z" },
    arrow_upward: { vb: "0 -960 960 960", d: "M450-686 223-459q-9 9-21 9t-21-9q-9-9-9-21t9-21l278-278q5-5 10-7t11-2q6 0 11 2t10 7l278 278q9 9 9 21t-9 21q-9 9-21 9t-21-9L510-686v496q0 13-8.5 21.5T480-160q-13 0-21.5-8.5T450-190v-496Z" },
    arrow_back: { vb: "0 -960 960 960", d: "m274-450 227 227q9 9 9 21t-9 21q-9 9-21 9t-21-9L181-459q-5-5-7-10t-2-11q0-6 2-11t7-10l278-278q9-9 21-9t21 9q9 9 9 21t-9 21L274-510h496q13 0 21.5 8.5T800-480q0 13-8.5 21.5T770-450H274Z" },
    hourglass_top: { vb: "0 -960 960 960", d: "M308-140h344v-127q0-72-50-121.5T480-438q-72 0-122 49.5T308-267v127ZM190-80q-13 0-21.5-8.5T160-110q0-13 8.5-21.5T190-140h58v-127q0-71 40-129t106-84q-66-27-106-85t-40-129v-126h-58q-13 0-21.5-8.5T160-850q0-13 8.5-21.5T190-880h580q13 0 21.5 8.5T800-850q0 13-8.5 21.5T770-820h-58v126q0 71-40 129t-106 85q66 26 106 84t40 129v127h58q13 0 21.5 8.5T800-110q0 13-8.5 21.5T770-80H190Z" },
    bookmark_add: { vb: "0 -960 960 960", d: "m480-240-196 84q-30 13-57-4.76-27-17.75-27-50.24v-574q0-24 18-42t42-18h260q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5H260v574l220-93 220 93v-304q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v304q0 32.49-27 50.24Q706-143 676-156l-196-84Zm0-545H260h290-70Zm220 90h-60q-12.75 0-21.37-8.68-8.63-8.67-8.63-21.5 0-12.82 8.63-21.32 8.62-8.5 21.37-8.5h60v-60q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v60h60q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5h-60v60q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-60Z" },
    check_circle: { vb: "0 -960 960 960", d: "m424-408-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-408Zm56 328q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" },
    refresh: { vb: "0 -960 960 960", d: "M480-160q-133 0-226.5-93.5T160-480q0-133 93.5-226.5T480-800q85 0 149 34.5T740-671v-99q0-13 8.5-21.5T770-800q13 0 21.5 8.5T800-770v194q0 13-8.5 21.5T770-546H576q-13 0-21.5-8.5T546-576q0-13 8.5-21.5T576-606h138q-38-60-97-97t-137-37q-109 0-184.5 75.5T220-480q0 109 75.5 184.5T480-220q75 0 140-39.5T717-366q5-11 16.5-16.5t22.5-.5q12 5 16 16.5t-1 23.5q-39 84-117.5 133.5T480-160Z" },
};

function bbIcon(name, size = 16) {
    const ic = ICONS[name];
    if (!ic) return "";
    return `<svg class="bb-icon" width="${size}" height="${size}" viewBox="${ic.vb}" fill="currentColor" aria-hidden="true"><path d="${ic.d}"/></svg>`;
}

// Mac vs PC for the keyboard shortcut hint shown in the inline mnemonic form.
const IS_MAC = typeof navigator !== "undefined"
    && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || "");
const HIGHLIGHT_SHORTCUT_LABEL = IS_MAC ? "⌘E" : "Ctrl+E";

// Languages the web app supports — kept in sync with bunbee.client/.../MnemonicsTab.jsx
const LANGUAGES = [
    { value: "en", label: "English" },
    { value: "es", label: "Spanish" },
    { value: "ja", label: "Japanese" },
    { value: "pt", label: "Portuguese" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
];

// Mnemonic types allowed per WaniKani subject type.
function allowedMnemonicTypes(subjectType) {
    if (subjectType === "radical") return ["meaning"];
    return ["meaning", "reading", "both"];
}

// State for the inline "new mnemonic" form. Lives at module scope so the value
// of inputs survives re-renders triggered by pill clicks or async actions.
const ADD_FORM_STATE = {
    open: false,
    type: "",
    language: "en",
    isPublic: true,
    text: "",
    error: "",
    submitting: false,
};

// ─── Top-level tabs (Mnemonics / Example sentences) ──────────────────────────
// Tracks which top-level tab is currently visible inside the panel body. Kept
// at module scope so the active tab survives subject changes within a session.
const TOPTAB_ORDER = ["mnemonics", "sentences"];
const TOPTAB_STATE = { active: "mnemonics" };

// Sets the active top-level tab. Updates the buttons (active class +
// aria-selected), shows/hides the matching panel, and toggles the visibility
// of the "+ Add" button (only relevant on the Mnemonics tab).
function setActiveTopTab(name) {
    if (!TOPTAB_ORDER.includes(name)) return;
    TOPTAB_STATE.active = name;

    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    panel.querySelectorAll(".bb-toptab").forEach((btn) => {
        const isActive = btn.dataset.toptab === name;
        btn.classList.toggle("bb-toptab--active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
        // Negative tabindex on inactive tabs is the standard ARIA pattern for
        // tablists — Tab/Shift+Tab moves focus past the inactive ones.
        btn.tabIndex = isActive ? 0 : -1;
    });

    panel.querySelectorAll(".bb-toptab-panel").forEach((el) => {
        el.classList.toggle("bb-toptab-panel--hidden", el.dataset.toptabPanel !== name);
    });

    const addBtn = panel.querySelector("#bb-add-mnemonic-btn");
    if (addBtn) addBtn.classList.toggle("bb-add-btn--hidden", name !== "mnemonics");
}

// Switches to the next/previous tab. `direction` is +1 (next) or -1 (prev).
function cycleTopTab(direction) {
    const idx = TOPTAB_ORDER.indexOf(TOPTAB_STATE.active);
    const next = (idx + direction + TOPTAB_ORDER.length) % TOPTAB_ORDER.length;
    setActiveTopTab(TOPTAB_ORDER[next]);
}

function isPanelOpen() {
    const body = document.querySelector(`#${PANEL_ID} .bb-body`);
    return !!body && !body.classList.contains("bb-collapsed");
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getJwt() {
    return new Promise((resolve) => {
        chrome.storage.local.get("bunbee_jwt", (result) => {
            resolve(result.bunbee_jwt ?? null);
        });
    });
}

// ─── WaniKani subject detection ───────────────────────────────────────────────
// WaniKani stores the current subject info in a <div data-subject-id> element
// and updates the DOM when the card changes. We observe mutations to detect it.

function getCurrentSubject() {
    // WaniKani renders the active character in this element during reviews
    const charEl = document.querySelector("#character, .character-header__characters, [data-subject-id]");
    if (!charEl) return null;

    const subjectId = charEl.dataset?.subjectId
        ?? document.querySelector("[data-subject-id]")?.dataset?.subjectId
        ?? null;

    const characters = charEl.textContent?.trim() ?? null;

    // Subject type is usually indicated by a class on the body or the quiz header
    const body = document.body;
    let subjectType = "vocabulary";
    if (body.classList.contains("radical") || document.querySelector(".radical")) subjectType = "radical";
    else if (body.classList.contains("kanji") || document.querySelector(".kanji")) subjectType = "kanji";

    // Prefer live DOM readings (fresh, post-answer reveal). If the live DOM
    // doesn't have them yet, fall back to whatever the readings cache picked
    // up from a background fetch of the subject's WK page. Either way the
    // returned array is deduped and may be empty.
    let readings = getCurrentReadings();
    if (readings.length === 0 && subjectId && SUBJECT_READINGS_CACHE.has(subjectId)) {
        readings = SUBJECT_READINGS_CACHE.get(subjectId);
    }

    return { subjectId, characters, subjectType, readings };
}

// Pulls the readings of the current subject from WaniKani's DOM. During an
// active review WK only reveals readings *after* the user has answered, so
// this is a best-effort scrape — callers must be prepared for an empty
// result and fall back to `fetchSubjectReadings` (which loads them from
// the subject's public page).
function getCurrentReadings(root = document) {
    const out = [];
    const seen = new Set();
    const selectors = [
        ".subject-readings__primary-reading",
        ".subject-readings__reading",
        ".subject-info-list--readings dd",
        ".subject-info-list--readings .subject-info-list__item-value",
        ".reading .reading-with-okurigana",
        "[data-reading-target='primary'] + dd",
        // Newer Stimulus-based subject page layout.
        ".subject-readings__reading-items .subject-readings__reading-item",
        ".subject-readings .reading",
    ];
    for (const sel of selectors) {
        root.querySelectorAll(sel).forEach((el) => {
            const text = el.textContent?.trim();
            // Defensive filters: skip empty, very long blocks (probably a wrong
            // selector match), and anything that looks like a label/sentence.
            if (!text || text.length > 30) return;
            if (/^\s*reading[s]?\s*$/i.test(text)) return;
            if (seen.has(text)) return;
            seen.add(text);
            out.push(text);
        });
    }
    return out;
}

// Cache of readings keyed by subjectId. Populated either by the live DOM
// scrape (when readings are visible after answer) or by an async call to
// the WaniKani v2 API. Persisting them here means that the inline "+ Add"
// form always has them available, regardless of where in the review flow
// the user opened it.
const SUBJECT_READINGS_CACHE = new Map();

function getWkToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get("wk_token", (result) => {
            resolve(result.wk_token ?? null);
        });
    });
}

// Async: fetch the subject by id from WaniKani's official v2 API and pull
// every reading off the JSON response. Mirrors the approach used by the
// web app in lib/api.js (`https://api.wanikani.com/v2/subjects?ids=...`)
// so behaviour is identical across surfaces. Returns [] on any failure
// (no token, network error, non-2xx) — never throws.
async function fetchSubjectReadings(subjectId) {
    if (!subjectId) return [];
    if (SUBJECT_READINGS_CACHE.has(subjectId)) {
        return SUBJECT_READINGS_CACHE.get(subjectId);
    }
    const token = await getWkToken();
    if (!token) {
        // The user probably installed the extension before we started
        // persisting the WK token in the popup. Surface a helpful hint
        // exactly once per session and then bail.
        if (!fetchSubjectReadings._warnedNoToken) {
            console.warn("[Bunbee] No WaniKani API token stored — open the extension popup and re-enter your token to enable readings.");
            fetchSubjectReadings._warnedNoToken = true;
        }
        return [];
    }
    try {
        const res = await fetch(`https://api.wanikani.com/v2/subjects/${subjectId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            console.warn("[Bunbee] WK subjects API returned", res.status);
            return [];
        }
        const data = await res.json();
        const readings = Array.isArray(data?.data?.readings)
            ? data.data.readings.map((r) => r.reading).filter(Boolean)
            : [];
        // Dedupe while preserving the API's order (which puts primary
        // readings first — handy for the "+ Add" toolbar).
        const seen = new Set();
        const unique = [];
        for (const r of readings) {
            if (seen.has(r)) continue;
            seen.add(r);
            unique.push(r);
        }
        SUBJECT_READINGS_CACHE.set(subjectId, unique);
        return unique;
    } catch (err) {
        console.warn("[Bunbee] fetchSubjectReadings failed:", err);
        return [];
    }
}

// Returns "meaning" | "reading" | null. WaniKani exposes the active question
// type in several places depending on the page layout, so we try multiple
// signals in order of reliability and fall back to scanning the visible label.
function getCurrentQuestionType() {
    const body = document.body;
    if (body.classList.contains("quiz-input--meaning")) return "meaning";
    if (body.classList.contains("quiz-input--reading")) return "reading";

    const stim = document.querySelector("[data-quiz-input-question-type-value]");
    const stimVal = stim?.dataset?.quizInputQuestionTypeValue?.toLowerCase();
    if (stimVal === "meaning" || stimVal === "reading") return stimVal;

    const attrEl = document.querySelector("[data-question-type]");
    const attrVal = attrEl?.dataset?.questionType?.toLowerCase();
    if (attrVal === "meaning" || attrVal === "reading") return attrVal;

    // Visible label (e.g. "Reading" / "Meaning" / "Name") — radicals show
    // "Name" but in our DB they map to mnemonicType="meaning".
    const labelEl = document.querySelector(
        "#character-header__question-type, .quiz-input__question-type, .character-header__question-type, [data-quiz-input-target='questionType']"
    );
    const labelText = labelEl?.textContent?.trim().toLowerCase();
    if (labelText) {
        if (labelText.includes("reading")) return "reading";
        if (labelText.includes("meaning") || labelText.includes("name")) return "meaning";
    }

    return null;
}

// ─── Panel HTML ───────────────────────────────────────────────────────────────

function createPanel() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    // Build the icon as a real <img> with src pointing at the extension's
    // packaged asset. We don't use a `data:` URI inside innerHTML because
    // WaniKani's CSP (`img-src 'self'`) does not include `data:` and would
    // block it; extension URLs (`moz-extension://`, `chrome-extension://`)
    // are allowed for content-script-injected images.
    // The body starts collapsed (.bb-collapsed) — the user requested that the
    // panel default to hidden on every new review. Pressing "B" or clicking the
    // toggle expands it. We also reset to collapsed in onSubjectChange().
    panel.innerHTML = `
        <div class="bb-header">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADmUlEQVQ4T22TbUxbVRjH/6e3t/deaGlKBLaWVSiClI2GdUtmY9mIkElY2DTiiBqJ2bR8WaImfjNGNqNGPy3GxbjEmhlA98EP2lAWFjcMboSY1owMViZWxsvWl7W19AXuvb33emjcB41PcpKT5zn//3OeX84hR12uyoSUGeF4rtbe6Bjt6X1henh4WMb/xMjIiG7h1s3upcidV4iixIyVzGfE22635ETlJw1qh4HjC1bbnjM/TP78DSFE+6+H96BzKJ/LXRQl0UB0ujm9nnmN7Bx60eMRkhBtf20mj/J6/nXCqCe5KmVdljl2p86yopyKlZoVSQoIHPdJpclyxayw8UAoVCwbPAqfr7/i5vVfz7J6pr6l1RY28bo6huFIfktLLixGD8myuuRw7j4XCISKjzRlA03TyCFnU7Olhh10tVU919BYt9/ucJEqoQidmsNmQcXKShzr66lwaD4b2Cwql2dDdyM7Y5YNXh085iRS7OMer9Dt9ViN9Q026DgroNBGUhKgOFRZxv37Wcz9li5+9+PG1dUH0rnQ/HKYnDp+3CQZMqN9h/V9J3qter6CB1VDA/XWGQC1BFLK01sqtBWBKCqYmsnIX41FJ9IZvEV6vK6hvc3spY/ebYeBN6BEzzEsA4bqNU1Hm9OEKtF8CUpJA0sL25KGTy9EtCvXY6eIZ//j02+ebjky0N+I2XACn/uXMHCiCc8fa6QOVFwSy7y+D67BP3YX773djqfcNQhcXYf/23sBcvigI3n2TOtjndY63IikMHYjiq4uOw50WJBKFkCIimoLj7lwGlPXVnH6yBPobKvBzFoC5y//sUyedjfce+elZnu/2Qq5mkVsl4RauxGra1ncvpPeIQFniwX1NhMSDzaxJ8ZCHy9h4uEG/DOpeTpC0yWv2zz0/htt4M0CYKIQDXQpIra2pTJMgWcoC7qjQFFQUHiYx/nxCGYXyRekt9Pt4gR1+mQ3axnos4IRKgHeBOgFKhChMSwVq4CYg0Z5KCqLqV8yuDi6Es8X2UHi8/nYjZXIy0ROf9jfJezue6ZWZzZxMAgCNasoA1REEbK4jXy2gOC1hDoeTMcJqfrAecDrLz+kYDDIjX994dlo9HdfrVne595XtevJljrObKRlqYh0VsLy2tb23K1sPJbCbaPR+GWFxT41OTkp/usveDx7q3OJZKskK03VFktHSVUdDNGVFFX5M5/PLzAMu9zQ6licmKAz/BN/Ay2UiQF0vyrSAAAAAElFTkSuQmCC" class="bb-logo" alt="Bunbee" />
            <span class="bb-title">Bunbee</span>
            <button class="bb-toggle" title="Toggle panel (B)" aria-label="Toggle panel">${bbIcon("keyboard_arrow_up", 16)}</button>
        </div>
        <div class="bb-body bb-collapsed">
            <div class="bb-toptabs" role="tablist" aria-label="Bunbee sections">
                <button type="button" class="bb-toptab bb-toptab--active"
                        id="bb-toptab-mnemonics" role="tab" aria-selected="true"
                        aria-controls="bb-toptab-panel-mnemonics" data-toptab="mnemonics"
                        title="Mnemonics (← →)">
                    ${bbIcon("psychology", 16)} Mnemonics
                </button>
                <button type="button" class="bb-toptab"
                        id="bb-toptab-sentences" role="tab" aria-selected="false"
                        aria-controls="bb-toptab-panel-sentences" data-toptab="sentences"
                        title="Example sentences (← →)">
                    ${bbIcon("auto_awesome", 16)} Example sentences
                </button>
                <button type="button" class="bb-add-btn" id="bb-add-mnemonic-btn"
                        title="Create a new mnemonic for this item">
                    + Add
                </button>
            </div>
            <div class="bb-toptab-panel"
                 id="bb-toptab-panel-mnemonics" role="tabpanel"
                 aria-labelledby="bb-toptab-mnemonics" data-toptab-panel="mnemonics">
                <div class="bb-content" id="bb-mnemonics-content">
                    <span class="bb-muted">Loading…</span>
                </div>
            </div>
            <div class="bb-toptab-panel bb-toptab-panel--hidden"
                 id="bb-toptab-panel-sentences" role="tabpanel"
                 aria-labelledby="bb-toptab-sentences" data-toptab-panel="sentences">
                <div class="bb-content" id="bb-sentences-content">
                    <button class="bb-btn" id="bb-generate-btn">Generate sentences</button>
                </div>
            </div>
            <div class="bb-footer">
                <span class="bb-muted" id="bb-status"></span>
            </div>
        </div>
    `;
    return panel;
}

// ─── Collapse / expand panel ──────────────────────────────────────────────────
// Keeps the .bb-body class in sync with the toggle button's caret. Used by:
//   • the toggle button click handler in injectPanel()
//   • the global "B" keyboard shortcut
//   • onSubjectChange(), which forces the panel collapsed on every new review

function setPanelCollapsed(collapsed) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const body = panel.querySelector(".bb-body");
    const toggle = panel.querySelector(".bb-toggle");
    if (!body || !toggle) return;
    body.classList.toggle("bb-collapsed", collapsed);
    toggle.innerHTML = bbIcon(collapsed ? "keyboard_arrow_up" : "keyboard_arrow_down", 16);
}

function togglePanelCollapsed() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const body = panel.querySelector(".bb-body");
    if (!body) return;
    setPanelCollapsed(!body.classList.contains("bb-collapsed"));
}

// "B" toggles the panel. We ignore the keystroke when the user is actively
// typing in WK's answer field so we don't swallow the "b" of e.g. "ba" → ば.
// We DO accept the shortcut when the input is in WK's "answered" state so it
// works alongside WK's own post-answer shortcuts like "F" (subject info).
//
// WK signals the answered state in several ways depending on layout/version:
//   • `disabled` / `readonly` properties on the <input>
//   • `aria-readonly="true"` on the <input>
//   • a non-standard `enabled="false"` attribute on the <input>
//   • `.quiz-input--correct` / `--incorrect` modifier class on an ancestor
//   • `correct="true"` / `incorrect="true"` attribute on the input container
//     (data-quiz-input-target="inputContainer") — this is the current variant
//   • `.complete` / `.answered` on an ancestor (older layouts)
// If ANY of these are true we let the shortcut fire even when the input still
// has focus, so the user doesn't have to click somewhere else first.
function isAnsweredInput(target) {
    if (target.readOnly || target.disabled) return true;
    if (target.getAttribute("aria-readonly") === "true") return true;
    if (target.getAttribute("enabled") === "false") return true;
    if (target.closest(".quiz-input--correct, .quiz-input--incorrect, .complete, .answered")) return true;
    // Container-level attribute variant.
    if (target.closest(
        "[data-quiz-input-target='inputContainer'][correct='true'], " +
        "[data-quiz-input-target='inputContainer'][incorrect='true']"
    )) return true;
    return false;
}

function isUserTyping(target) {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea") {
        return !isAnsweredInput(target);
    }
    if (tag === "select") return true;
    if (target.isContentEditable) return true;
    return false;
}

function setupShortcuts() {
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        if (isUserTyping(e.target)) return;

        if (e.key === "b" || e.key === "B") {
            e.preventDefault();
            togglePanelCollapsed();
            return;
        }

        // ←/→ cycle the top-level tabs (Mnemonics ↔ Example sentences) but
        // only while the panel is open, so we don't hijack arrow keys when
        // the user has the panel collapsed and is doing something else on
        // the WK page (e.g. arrow-key scrolling).
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            if (!isPanelOpen()) return;
            e.preventDefault();
            cycleTopTab(e.key === "ArrowRight" ? 1 : -1);
            return;
        }

        // "N" triggers the primary action of the active tab:
        //   • Mnemonics tab        → open the "+ Add" form
        //   • Example sentences    → run "Generate sentences" / "Try again"
        // We invoke the underlying handlers directly rather than dispatching
        // synthetic clicks: it sidesteps any subtle interaction with WK's own
        // keyboard listeners and makes the shortcut behave identically across
        // every WK page layout.
        if (e.key === "n" || e.key === "N") {
            if (!isPanelOpen()) return;
            const panel = document.getElementById(PANEL_ID);
            if (!panel) return;

            if (TOPTAB_STATE.active === "mnemonics") {
                e.preventDefault();
                triggerAddMnemonic();
            } else if (TOPTAB_STATE.active === "sentences") {
                // Only fire when the Generate button is currently in the DOM
                // (i.e. the user hasn't already generated sentences for this
                // subject); otherwise we let the keystroke fall through.
                if (panel.querySelector("#bb-generate-btn")) {
                    e.preventDefault();
                    handleGenerate();
                }
            }
        }
    });
}

// ─── Inject panel into page ───────────────────────────────────────────────────
// WaniKani's review UI has a #quiz-queue or #character section we can append to.

function injectPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = createPanel();

    // Try to insert after the character/quiz card
    const anchor =
        document.querySelector(".additional-content__menu") ??
        document.querySelector(".additional-content") ??
        document.querySelector("#character") ??
        document.querySelector(".character-header") ??
        document.querySelector("#quiz-queue") ??
        document.querySelector("main");

    if (anchor) {
        anchor.insertAdjacentElement("afterend", panel);
    } else {
        document.body.appendChild(panel);
    }

    // Single delegated click listener for the entire panel. Using one listener
    // on the panel root (instead of per-element listeners) makes the wiring
    // bulletproof against a few subtle issues we've hit:
    //   • Per-button listeners can stop firing if something replaces the
    //     element (the listener stays on the orphaned node).
    //   • WaniKani's page CSS occasionally sets `pointer-events: none` on
    //     deeply-nested `button > svg` graphs; delegating up to the panel
    //     root ensures any click inside the panel reaches us.
    //   • Click targets can be SVG paths inside icons; `.closest()` walks up
    //     to whichever logical action the user actually meant.
    panel.addEventListener("click", (e) => {
        // 1) "+ Add" button — must be checked BEFORE the toptab branch
        //    because the button lives inside .bb-toptabs as a sibling of
        //    the actual tabs.
        if (e.target.closest("#bb-add-mnemonic-btn")) {
            e.stopPropagation();
            triggerAddMnemonic();
            return;
        }
        // 2) Top-level tab switch (Mnemonics / Example sentences)
        const tab = e.target.closest(".bb-toptab");
        if (tab) {
            e.stopPropagation();
            setActiveTopTab(tab.dataset.toptab);
            return;
        }
        // 3) Generate sentences button. Looked up live because it gets
        //    re-rendered (replaced or rewritten) when sentences load,
        //    fail, or are reset on subject change.
        if (e.target.closest("#bb-generate-btn")) {
            e.stopPropagation();
            handleGenerate();
            return;
        }
        // 4) Anywhere else inside the header → toggle collapse.
        if (e.target.closest(".bb-header")) {
            togglePanelCollapsed();
            return;
        }
    });

    // Apply the initial active tab — handles the case where the user already
    // had the sentences tab selected before a refresh: TOPTAB_STATE persists
    // across re-injections within the same SPA session.
    setActiveTopTab(TOPTAB_STATE.active);
}

// Single source of truth for "open the new-mnemonic form". Used by both the
// "+ Add" button click handler and the "N" keyboard shortcut so they stay in
// sync. We avoid relying on `btn.click()` from the shortcut path because that
// dispatches a synthetic event whose timing/ordering can interact with WK's
// own keydown listeners in subtle ways — calling the action directly is both
// simpler and more deterministic.
async function triggerAddMnemonic() {
    const subject = getCurrentSubject();
    if (!subject?.subjectId) {
        window.open(`${BUNBEE_WEB}/mnemonics/new`, "_blank", "noopener,noreferrer");
        return;
    }

    // Render the form immediately with whatever we have (so the UI feels
    // snappy), then enrich with readings asynchronously if the DOM didn't
    // expose any yet. Radicals never have readings, so skip the fetch for
    // them entirely.
    ADD_FORM_STATE.open = true;
    ADD_FORM_STATE.error = "";
    showAddForm(subject);

    requestAnimationFrame(() => {
        const ta = document.querySelector("#bb-add-text");
        if (ta) ta.focus();
    });

    if (subject.subjectType !== "radical"
        && (!subject.readings || subject.readings.length === 0)) {
        const readings = await fetchSubjectReadings(subject.subjectId);
        if (readings.length === 0) return;
        // Only re-render if the form is still open for the same subject —
        // the user might have closed the form or moved to the next card
        // while we were fetching.
        if (!ADD_FORM_STATE.open) return;
        const current = getCurrentSubject();
        if (current?.subjectId !== subject.subjectId) return;
        // Preserve whatever the user has already typed.
        const ta = document.querySelector("#bb-add-text");
        if (ta) ADD_FORM_STATE.text = ta.value;
        showAddForm({ ...subject, readings });
    }
}

// ─── Load mnemonics ───────────────────────────────────────────────────────────
// The mnemonics section is split into two tabs:
//   • "My mnemonics"     → mnemonics created by the logged-in user (m.isOwn)
//   • "Public mnemonics" → community mnemonics (others), sorted by score
// Each tab shows the top 3 entries.

const TAB_STATE = { active: "public" };

function renderMnemonicCard(m) {
    return `
        <div class="bb-mnemonic">
            <div class="bb-mnemonic-meta">
                <span class="bb-badge bb-badge--${m.mnemonicType}">${m.mnemonicType}</span>
                <span class="bb-badge">${m.language?.toUpperCase()}</span>
                <span class="bb-score">${bbIcon("arrow_upward", 12)} ${m.score}</span>
            </div>
            <div class="bb-mnemonic-text">${renderHighlights(m.text)}</div>
            <div class="bb-mnemonic-author">by ${m.username}</div>
            <button class="bb-save-btn" data-id="${m.id}" data-saved="${m.isSaved}">
                ${m.isSaved ? `${bbIcon("check_circle", 14)} Saved` : `${bbIcon("bookmark_add", 14)} Save`}
            </button>
        </div>
    `;
}

function renderEmptyState(kind) {
    if (kind === "my") {
        return `<span class="bb-muted">You haven't created mnemonics for this item yet.</span>`;
    }
    return `<span class="bb-muted">No community mnemonics yet for this item.</span>`;
}

function renderMnemonicsPanel(myTop, publicTop, myCount, publicCount) {
    const isMy = TAB_STATE.active === "my";
    // We use class modifiers (--hidden) instead of inline `style="display:..."`
    // because WaniKani's CSP (`style-src 'self'`) blocks inline style attributes.
    return `
        <div class="bb-tabs">
            <button class="bb-tab ${isMy ? "bb-tab--active" : ""}" data-tab="my">
                My (${myCount})
            </button>
            <button class="bb-tab ${!isMy ? "bb-tab--active" : ""}" data-tab="public">
                Public (${publicCount})
            </button>
        </div>
        <div class="bb-tab-panel ${isMy ? "" : "bb-tab-panel--hidden"}" data-panel="my">
            ${myTop.length ? myTop.map(renderMnemonicCard).join("") : renderEmptyState("my")}
        </div>
        <div class="bb-tab-panel ${!isMy ? "" : "bb-tab-panel--hidden"}" data-panel="public">
            ${publicTop.length ? publicTop.map(renderMnemonicCard).join("") : renderEmptyState("public")}
        </div>
    `;
}

async function loadMnemonics(subjectId) {
    const jwt = await getJwt();
    const el = document.getElementById("bb-mnemonics-content");
    if (!el) return;

    if (!jwt) {
        el.innerHTML = `<span class="bb-muted">Log in via the Bunbee extension popup to see mnemonics.</span>`;
        return;
    }

    if (!subjectId) {
        el.innerHTML = `<span class="bb-muted">Subject not detected yet.</span>`;
        return;
    }

    el.innerHTML = `<span class="bb-muted">Loading…</span>`;

    try {
        const res = await fetch(`${BUNBEE_API}/api/mnemonics/subject/${subjectId}`, {
            headers: { Authorization: `Bearer ${jwt}` },
        });

        if (!res.ok) throw new Error(`${res.status}`);
        const text = await res.text();
        const mnemonics = text ? JSON.parse(text) : [];

        // Filter by the current review question type: a "meaning" review only
        // shows meaning + both mnemonics; a "reading" review only shows reading
        // + both. If we couldn't detect the question type (e.g. lessons or
        // pre-quiz screens), fall through and show everything.
        const questionType = getCurrentQuestionType();
        const matchesType = (m) => {
            if (!questionType) return true;
            return m.mnemonicType === questionType || m.mnemonicType === "both";
        };
        const filtered = mnemonics.filter(matchesType);

        // We always render the tab structure — even when there are no
        // mnemonics — so the user sees the "My / Public" UI plus an empty
        // state inside each panel, instead of a single "no mnemonics" line.
        const byScore = (a, b) => (b.score ?? 0) - (a.score ?? 0);
        const mine = filtered.filter((m) => m.isOwn).sort(byScore);
        const community = filtered.filter((m) => !m.isOwn).sort(byScore);

        // If the active tab is empty but the other has content, switch to it.
        if (TAB_STATE.active === "my" && !mine.length && community.length) {
            TAB_STATE.active = "public";
        } else if (TAB_STATE.active === "public" && !community.length && mine.length) {
            TAB_STATE.active = "my";
        }

        const renderInto = (target) => {
            target.innerHTML = renderMnemonicsPanel(
                mine.slice(0, 3),
                community.slice(0, 3),
                mine.length,
                community.length,
            );

            target.querySelectorAll(".bb-tab").forEach((btn) => {
                btn.addEventListener("click", () => {
                    TAB_STATE.active = btn.dataset.tab;
                    renderInto(target);
                });
            });

            target.querySelectorAll(".bb-save-btn").forEach((btn) => {
                btn.addEventListener("click", () => handleSaveMnemonic(btn));
            });
        };

        renderInto(el);

    } catch (e) {
        el.innerHTML = `<span class="bb-muted">Could not load mnemonics (${e.message}).</span>`;
    }
}

// ─── New mnemonic (inline form) ───────────────────────────────────────────────
// When the user clicks "+ Add" we replace the contents of #bb-mnemonics-content
// with a small form that POSTs to /api/mnemonics. The form supports the same
// ==text== highlight syntax and Ctrl/⌘+E shortcut as the web app, and uses
// only CSS classes (no inline `style="..."`) to stay within WaniKani's CSP.

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderAddForm(subject) {
    const types = allowedMnemonicTypes(subject?.subjectType);
    if (!ADD_FORM_STATE.type || !types.includes(ADD_FORM_STATE.type)) {
        ADD_FORM_STATE.type = types[0];
    }

    const typeBtns = types.map((t) => `
        <button type="button"
                class="bb-pill ${ADD_FORM_STATE.type === t ? "bb-pill--active" : ""}"
                data-type="${t}">
            ${t.charAt(0).toUpperCase()}${t.slice(1)}
        </button>
    `).join("");

    const langOptions = LANGUAGES.map((l) => `
        <option value="${l.value}" ${ADD_FORM_STATE.language === l.value ? "selected" : ""}>
            ${l.label}
        </option>
    `).join("");

    const errorBlock = ADD_FORM_STATE.error
        ? `<div class="bb-form-error">${escapeHtml(ADD_FORM_STATE.error)}</div>`
        : "";

    // Insert-at-cursor toolbar buttons mirror the web app's mnemonics/new
    // editor: a primary button for the subject's characters and one button
    // per known reading. Readings are extracted from WK's DOM at form-render
    // time (typically only available after the user has answered).
    const charButton = subject?.characters
        ? `<button type="button" class="bb-insert-btn bb-insert-btn--char" data-insert="${escapeHtml(subject.characters)}"
                   title="Insert &quot;${escapeHtml(subject.characters)}&quot;">
                ${escapeHtml(subject.characters)}
            </button>`
        : "";
    const readings = Array.isArray(subject?.readings) ? subject.readings : [];
    const readingButtons = readings.map((r) => `
        <button type="button" class="bb-insert-btn" data-insert="${escapeHtml(r)}"
                title="Insert reading &quot;${escapeHtml(r)}&quot;">
            ${escapeHtml(r)}
        </button>
    `).join("");
    const insertDivider = (charButton || readingButtons)
        ? `<span class="bb-toolbar-divider" aria-hidden="true"></span>`
        : "";

    return `
        <div class="bb-add-form">
            <div class="bb-form-header">
                <button type="button" class="bb-link-btn" id="bb-add-back">${bbIcon("arrow_back", 14)} Back to list</button>
                <span class="bb-form-subject">New mnemonic for <strong>${escapeHtml(subject?.characters ?? "")}</strong></span>
            </div>

            <div class="bb-form-row">
                <span class="bb-form-label">Type</span>
                <div class="bb-pills">${typeBtns}</div>
            </div>

            <div class="bb-form-row">
                <label class="bb-form-label" for="bb-add-language">Language</label>
                <select id="bb-add-language" class="bb-select">${langOptions}</select>
            </div>

            <div class="bb-form-row">
                <div class="bb-form-toolbar">
                    <span class="bb-form-label">Mnemonic</span>
                    <div class="bb-toolbar-actions">
                        <button type="button" class="bb-tool-btn" id="bb-add-highlight"
                                title="Wrap selection in ==…== (${HIGHLIGHT_SHORTCUT_LABEL})">
                            ${bbIcon("auto_awesome", 13)} Highlight (${HIGHLIGHT_SHORTCUT_LABEL})
                        </button>
                        ${insertDivider}
                        ${charButton}
                        ${readingButtons}
                    </div>
                </div>
                <textarea id="bb-add-text" class="bb-textarea" rows="4"
                    placeholder="Write your mnemonic. Wrap key words with ==text== to highlight them.">${escapeHtml(ADD_FORM_STATE.text)}</textarea>
            </div>

            <div class="bb-form-row bb-form-row--inline">
                <label class="bb-checkbox">
                    <input type="checkbox" id="bb-add-private" ${!ADD_FORM_STATE.isPublic ? "checked" : ""} />
                    <span>Make private</span>
                </label>
            </div>

            ${errorBlock}

            <div class="bb-form-actions">
                <button type="button" class="bb-btn bb-btn--secondary" id="bb-add-cancel">Cancel</button>
                <button type="button" class="bb-btn" id="bb-add-save" ${ADD_FORM_STATE.submitting ? "disabled" : ""}>
                    ${ADD_FORM_STATE.submitting ? "Saving…" : "Save mnemonic"}
                </button>
            </div>
        </div>
    `;
}

// Inserts `insertion` at the textarea's current cursor position (replacing
// any current selection) and places the cursor right after the inserted text.
// Mirrors the main app's `insertAtCursor` in MnemonicsTab.jsx so the editor
// behaves identically across both surfaces.
function insertAtCursor(ta, insertion) {
    if (!ta || !insertion) return;
    const text = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = text.slice(0, start) + insertion + text.slice(end);
    ta.value = next;
    ADD_FORM_STATE.text = next;
    requestAnimationFrame(() => {
        ta.focus();
        const pos = start + insertion.length;
        ta.setSelectionRange(pos, pos);
    });
}

// Wraps the current textarea selection in ==...==, or toggles them off if the
// selection already starts and ends with ==. Same behavior as the main app's
// `applyHighlight` in MnemonicsTab.jsx so users get a consistent experience.
function applyHighlightToTextarea(ta) {
    const text = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    let next, newStart, newEnd;
    if (start === end) {
        next = text.slice(0, start) + "====" + text.slice(end);
        newStart = newEnd = start + 2;
    } else {
        const sel = text.slice(start, end);
        if (sel.startsWith("==") && sel.endsWith("==")) {
            const inner = sel.slice(2, -2);
            next = text.slice(0, start) + inner + text.slice(end);
            newStart = start;
            newEnd = start + inner.length;
        } else {
            const wrapped = "==" + sel + "==";
            next = text.slice(0, start) + wrapped + text.slice(end);
            newStart = start;
            newEnd = start + wrapped.length;
        }
    }

    ta.value = next;
    ADD_FORM_STATE.text = next;
    requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(newStart, newEnd);
    });
}

function showAddForm(subject) {
    const el = document.getElementById("bb-mnemonics-content");
    if (!el) return;

    el.innerHTML = renderAddForm(subject);

    // Capture latest input values into state before any re-render so the
    // user doesn't lose what they typed when they click a type pill.
    const captureInputs = () => {
        const ta = el.querySelector("#bb-add-text");
        const sel = el.querySelector("#bb-add-language");
        const priv = el.querySelector("#bb-add-private");
        if (ta) ADD_FORM_STATE.text = ta.value;
        if (sel) ADD_FORM_STATE.language = sel.value;
        if (priv) ADD_FORM_STATE.isPublic = !priv.checked;
    };

    el.querySelectorAll(".bb-pill[data-type]").forEach((btn) => {
        btn.addEventListener("click", () => {
            captureInputs();
            ADD_FORM_STATE.type = btn.dataset.type;
            showAddForm(subject);
        });
    });

    el.querySelector("#bb-add-language")?.addEventListener("change", (e) => {
        ADD_FORM_STATE.language = e.target.value;
    });

    el.querySelector("#bb-add-private")?.addEventListener("change", (e) => {
        ADD_FORM_STATE.isPublic = !e.target.checked;
    });

    const ta = el.querySelector("#bb-add-text");
    if (ta) {
        ta.addEventListener("input", () => {
            ADD_FORM_STATE.text = ta.value;
        });
        ta.addEventListener("keydown", (e) => {
            const meta = IS_MAC ? e.metaKey : e.ctrlKey;
            if (meta && (e.key === "e" || e.key === "E")) {
                e.preventDefault();
                applyHighlightToTextarea(ta);
            }
        });
    }

    el.querySelector("#bb-add-highlight")?.addEventListener("click", () => {
        if (ta) applyHighlightToTextarea(ta);
    });

    // Insert-at-cursor toolbar buttons. Delegated on the toolbar so a single
    // listener handles the character button and any number of reading buttons.
    el.querySelector(".bb-form-toolbar")?.addEventListener("click", (e) => {
        const btn = e.target.closest(".bb-insert-btn");
        if (!btn || !ta) return;
        const insertion = btn.dataset.insert;
        if (!insertion) return;
        captureInputs();
        insertAtCursor(ta, insertion);
    });

    const closeForm = () => {
        ADD_FORM_STATE.open = false;
        ADD_FORM_STATE.error = "";
        loadMnemonics(subject.subjectId);
    };
    el.querySelector("#bb-add-back")?.addEventListener("click", closeForm);
    el.querySelector("#bb-add-cancel")?.addEventListener("click", closeForm);

    el.querySelector("#bb-add-save")?.addEventListener("click", () => {
        captureInputs();
        handleSaveNewMnemonic(subject);
    });

    // Auto-focus textarea so the user can start typing immediately.
    if (ta && !ADD_FORM_STATE.submitting) ta.focus();
}

async function handleSaveNewMnemonic(subject) {
    const jwt = await getJwt();
    if (!jwt) {
        ADD_FORM_STATE.error = "You need to be logged in via the Bunbee popup.";
        return showAddForm(subject);
    }

    const text = (ADD_FORM_STATE.text || "").trim();
    if (!text) {
        ADD_FORM_STATE.error = "Write your mnemonic first.";
        return showAddForm(subject);
    }
    if (!ADD_FORM_STATE.type) {
        ADD_FORM_STATE.error = "Select a mnemonic type.";
        return showAddForm(subject);
    }
    if (!subject?.subjectId) {
        ADD_FORM_STATE.error = "Could not detect the current subject.";
        return showAddForm(subject);
    }

    ADD_FORM_STATE.submitting = true;
    ADD_FORM_STATE.error = "";
    showAddForm(subject);

    try {
        const res = await fetch(`${BUNBEE_API}/api/mnemonics`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
                waniKaniSubjectId: parseInt(subject.subjectId, 10),
                subjectType: subject.subjectType ?? "vocabulary",
                mnemonicType: ADD_FORM_STATE.type,
                characters: subject.characters ?? "",
                // We don't have the full meanings list from the WK DOM, so we
                // send an empty array. The web app lets the user edit later.
                meanings: [],
                text,
                language: ADD_FORM_STATE.language || "en",
                isPublic: !!ADD_FORM_STATE.isPublic,
            }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`${res.status} ${body || res.statusText}`);
        }

        // Success: clear form, switch to "My" so the new mnemonic is visible,
        // and reload the list.
        ADD_FORM_STATE.open = false;
        ADD_FORM_STATE.text = "";
        ADD_FORM_STATE.error = "";
        TAB_STATE.active = "my";
        await loadMnemonics(subject.subjectId);
    } catch (e) {
        ADD_FORM_STATE.error = `Could not save: ${e.message}`;
        showAddForm(subject);
    } finally {
        ADD_FORM_STATE.submitting = false;
    }
}

// ─── Generate sentences ───────────────────────────────────────────────────────

// Maps the HTTP status returned by /api/geminiproxy/generate to a friendly
// message. Mirrors describeGenerateError() in the web app so the extension
// surfaces the same wording — Gemini's status codes are forwarded as-is by
// the proxy, and the proxy itself returns 429 for the per-IP rate limit.
function describeGenerateError(status, rawBody) {
    let geminiMsg = "";
    try {
        const parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
        geminiMsg = parsed?.error?.message ?? parsed?.message ?? "";
    } catch { /* body wasn't JSON */ }

    switch (status) {
        case 429:
            return "Too many requests in the last minute. Wait a few seconds and try again — Bunbee limits requests to keep things fair.";
        case 503:
            return "Gemini is overloaded right now (model busy). This usually clears up within a minute — wait a moment and try again.";
        case 504:
            return "Gemini took too long to respond. Try again in a moment.";
        case 500:
            return geminiMsg
                ? `Internal error from the AI service: ${geminiMsg}. Try again in a moment.`
                : "Internal error from the AI service. Try again in a moment.";
        case 401:
        case 403:
            return "The AI service rejected the request (authentication issue). If this keeps happening, please contact support.";
        case 400:
            return geminiMsg
                ? `The request was rejected: ${geminiMsg}.`
                : "The request was rejected by Gemini.";
        case 404:
            return "The configured AI model isn't available. Please contact support.";
        default:
            if (geminiMsg) return `Generation failed (${status}): ${geminiMsg}`;
            return `Generation failed (${status}). Please try again in a moment.`;
    }
}

async function handleGenerate() {
    const jwt = await getJwt();
    const el = document.getElementById("bb-sentences-content");
    if (!el) return;

    if (!jwt) {
        el.innerHTML = `<span class="bb-muted">Log in via the Bunbee extension popup first.</span>`;
        return;
    }

    const subject = getCurrentSubject();
    if (!subject?.characters) {
        el.innerHTML = `<span class="bb-muted">Could not detect current subject.</span>`;
        return;
    }

    el.innerHTML = `<span class="bb-muted">${bbIcon("hourglass_top", 14)} Generating…</span>`;

    const prompt = `You are a Japanese language teacher. Generate 2 example sentences using the word ${subject.characters}.
For each sentence use this exact format:
SENTENCE: [japanese]
READING: [furigana/romaji]
ENGLISH: [translation]
---`;

    const renderError = (message) => {
        el.innerHTML = `
            <div class="bb-form-error">${escapeHtml(message)}</div>
            <button class="bb-btn" id="bb-generate-btn">Try again</button>
        `;
        el.querySelector("#bb-generate-btn")?.addEventListener("click", handleGenerate);
    };

    try {
        const res = await fetch(`${BUNBEE_API}/api/geminiproxy/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ prompt }),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            renderError(describeGenerateError(res.status, body));
            return;
        }

        const data = await res.json();
        const sentences = parseSentences(data.text);

        if (!sentences.length) {
            renderError("Gemini returned a response, but Bunbee couldn't parse it into sentences. Try again — the model occasionally drifts from the expected format.");
            return;
        }

        el.innerHTML = sentences.map((s, i) => `
            <div class="bb-sentence" data-index="${i}">
                <div class="bb-sentence-jp">${s.sentence}</div>
                <div class="bb-sentence-reading">${s.reading}</div>
                <div class="bb-sentence-en">${s.english}</div>
                <button class="bb-save-sentence-btn" 
                    data-sentence='${JSON.stringify(s).replace(/'/g, "&#39;")}'
                    data-vocab="${subject.characters}">
                    ${bbIcon("bookmark_add", 14)} Save to Bunbee
                </button>
            </div>
        `).join("") + `<button class="bb-btn bb-btn--secondary" id="bb-regenerate-btn">${bbIcon("refresh", 14)} Regenerate</button>`;

        el.querySelectorAll(".bb-save-sentence-btn").forEach((btn) => {
            btn.addEventListener("click", () => handleSaveSentence(btn));
        });

        el.querySelector("#bb-regenerate-btn")?.addEventListener("click", handleGenerate);

    } catch (e) {
        renderError(`Network error reaching Bunbee: ${e.message}. Check your connection and try again.`);
    }
}

// ─── Save mnemonic ────────────────────────────────────────────────────────────

async function handleSaveMnemonic(btn) {
    const jwt = await getJwt();
    if (!jwt) return;

    const id = btn.dataset.id;
    const isSaved = btn.dataset.saved === "true";

    try {
        await fetch(`${BUNBEE_API}/api/mnemonics/${id}/save`, {
            method: isSaved ? "DELETE" : "POST",
            headers: { Authorization: `Bearer ${jwt}` },
        });
        btn.dataset.saved = isSaved ? "false" : "true";
        btn.innerHTML = isSaved
            ? `${bbIcon("bookmark_add", 14)} Save`
            : `${bbIcon("check_circle", 14)} Saved`;
    } catch { }
}

// ─── Save sentence ────────────────────────────────────────────────────────────

async function handleSaveSentence(btn) {
    const jwt = await getJwt();
    if (!jwt) return;

    const sentence = JSON.parse(btn.dataset.sentence);
    const vocab = btn.dataset.vocab;

    btn.textContent = "Saving…";
    btn.disabled = true;

    try {
        const res = await fetch(`${BUNBEE_API}/api/sentences`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
                vocabulary: vocab,
                sentence: sentence.sentence,
                reading: sentence.reading,
                english: sentence.english,
            }),
        });

        if (res.ok) {
            btn.innerHTML = `${bbIcon("check_circle", 14)} Saved!`;
        } else {
            btn.textContent = "Error — try again";
            btn.disabled = false;
        }
    } catch {
        btn.textContent = "Error — try again";
        btn.disabled = false;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderHighlights(text) {
    return text.replace(/==(.+?)==/g, "<mark>$1</mark>");
}

function parseSentences(text) {
    const clean = text.replace(/\*\*/g, "").replace(/\r\n/g, "\n");
    return clean.split(/(?=SENTENCE:)/).map((block) => {
        const sentence = block.match(/SENTENCE:\s*(.+?)(?:\n|$)/)?.[1]?.trim();
        const reading = block.match(/READING:\s*(.+?)(?:\n|$)/)?.[1]?.trim();
        const english = block.match(/ENGLISH:\s*(.+?)(?:\n|$)/)?.[1]?.trim();
        return sentence && reading && english ? { sentence, reading, english } : null;
    }).filter(Boolean);
}

// ─── Observe DOM changes ──────────────────────────────────────────────────────
// WaniKani is a SPA — we watch for subject changes via MutationObserver.

let lastSubjectId = null;
let lastQuestionType = null;

function onSubjectChange() {
    const subject = getCurrentSubject();
    if (!subject?.subjectId) return;

    // Reload when either the subject OR the question type changes — the same
    // subject can be shown twice in a session (once for meaning, once for
    // reading) and the visible mnemonics depend on the current question type.
    const questionType = getCurrentQuestionType();
    const subjectChanged = subject.subjectId !== lastSubjectId;
    const questionChanged = questionType !== lastQuestionType;
    if (!subjectChanged && !questionChanged) return;

    lastSubjectId = subject.subjectId;
    lastQuestionType = questionType;
    console.log("[Bunbee] Subject/question changed:", { ...subject, questionType });

    // Reset sentences section. The "Generate sentences" button doesn't need
    // its own listener — clicks bubble up to the panel-level delegated
    // handler that dispatches by id.
    const sentencesEl = document.getElementById("bb-sentences-content");
    if (sentencesEl) {
        sentencesEl.innerHTML = `<button class="bb-btn" id="bb-generate-btn">Generate sentences</button>`;
    }

    // Warm the readings cache in the background so the "+ Add" form has
    // them ready even if the user hits N before answering. Skipped for
    // radicals (they have no readings) and ignored on failure — the form
    // will still open with the character button.
    if (subject.subjectType !== "radical" && (!subject.readings || subject.readings.length === 0)) {
        fetchSubjectReadings(subject.subjectId).catch(() => {});
    }

    // If the user had the inline "new mnemonic" form open for the previous
    // subject, discard it: the text & type were specific to that item.
    ADD_FORM_STATE.open = false;
    ADD_FORM_STATE.text = "";
    ADD_FORM_STATE.error = "";

    // Reset to the Mnemonics tab on every new subject — that's the more
    // common starting point and matches what most users expect when a card
    // changes. Sentences require an explicit Generate click anyway.
    setActiveTopTab("mnemonics");

    // Per the user's preference: panel always starts hidden on a new review
    // (or when the question type flips). Press B or click the toggle to open.
    setPanelCollapsed(true);

    loadMnemonics(subject.subjectId);
}

const observer = new MutationObserver(() => {
    injectPanel();
    onSubjectChange();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
    injectPanel();
    setupShortcuts();
    onSubjectChange();

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}


window._bunbee = {
    reload: () => {
        const id = document.querySelector('label[data-subject-id]')?.dataset.subjectId;
        console.log("Reloading mnemonics for subject:", id);
        loadMnemonics(id);
    }
};