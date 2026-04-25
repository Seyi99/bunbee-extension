// ─── Bunbee content script ────────────────────────────────────────────────────
// Injects a panel below each review card showing mnemonics and a sentence
// generator for the current subject.

const BUNBEE_API = "https://api.bunbee.cc";
const BUNBEE_WEB = "https://bunbee.cc";
const PANEL_ID = "bunbee-panel";

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

    return { subjectId, characters, subjectType };
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
            <button class="bb-toggle" title="Toggle panel (B)">▲</button>
        </div>
        <div class="bb-body bb-collapsed">
            <div class="bb-section" id="bb-mnemonics">
                <div class="bb-section-title">
                    <span>🧠 Mnemonics</span>
                    <button class="bb-add-btn" id="bb-add-mnemonic-btn" title="Create a new mnemonic for this item">
                        + Add
                    </button>
                </div>
                <div class="bb-content" id="bb-mnemonics-content">
                    <span class="bb-muted">Loading…</span>
                </div>
            </div>
            <div class="bb-section" id="bb-sentences">
                <div class="bb-section-title">✨ Example sentences</div>
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
    toggle.textContent = collapsed ? "▲" : "▼";
}

function togglePanelCollapsed() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const body = panel.querySelector(".bb-body");
    if (!body) return;
    setPanelCollapsed(!body.classList.contains("bb-collapsed"));
}

// "B" toggles the panel. We ignore the keystroke if the user is typing in any
// editable element so it doesn't interfere with the review answer field
// (typing "ba" in romaji becomes ば and we don't want to swallow that "b").
function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (target.isContentEditable) return true;
    return false;
}

function setupShortcuts() {
    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        if (isEditableTarget(e.target)) return;
        if (e.key === "b" || e.key === "B") {
            e.preventDefault();
            togglePanelCollapsed();
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

    // Toggle collapse — uses class toggling instead of `el.style.display = ...`
    // to play nicely with strict CSPs that disallow inline styles.
    panel.querySelector(".bb-toggle").addEventListener("click", () => {
        togglePanelCollapsed();
    });

    // Generate button
    panel.querySelector("#bb-generate-btn").addEventListener("click", () => {
        handleGenerate();
    });

    // "+ Add mnemonic" — opens an inline form inside the panel for the current
    // subject. If we can't detect a subject (e.g. user is not on a review page)
    // we fall back to opening the web app's editor in a new tab.
    panel.querySelector("#bb-add-mnemonic-btn").addEventListener("click", () => {
        const subject = getCurrentSubject();
        if (!subject?.subjectId) {
            window.open(`${BUNBEE_WEB}/mnemonics/new`, "_blank", "noopener,noreferrer");
            return;
        }
        ADD_FORM_STATE.open = true;
        ADD_FORM_STATE.error = "";
        showAddForm(subject);
    });
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
                <span class="bb-score">▲ ${m.score}</span>
            </div>
            <div class="bb-mnemonic-text">${renderHighlights(m.text)}</div>
            <div class="bb-mnemonic-author">by ${m.username}</div>
            <button class="bb-save-btn" data-id="${m.id}" data-saved="${m.isSaved}">
                ${m.isSaved ? "✅ Saved" : "🔖 Save"}
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

    return `
        <div class="bb-add-form">
            <div class="bb-form-header">
                <button type="button" class="bb-link-btn" id="bb-add-back">← Back to list</button>
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
                    <button type="button" class="bb-tool-btn" id="bb-add-highlight"
                            title="Wrap selection in ==…== (${HIGHLIGHT_SHORTCUT_LABEL})">
                        ✨ Highlight (${HIGHLIGHT_SHORTCUT_LABEL})
                    </button>
                </div>
                <textarea id="bb-add-text" class="bb-textarea" rows="4"
                    placeholder="Write your mnemonic. Wrap key words with ==text== to highlight them.">${escapeHtml(ADD_FORM_STATE.text)}</textarea>
            </div>

            <div class="bb-form-row bb-form-row--inline">
                <label class="bb-checkbox">
                    <input type="checkbox" id="bb-add-public" ${ADD_FORM_STATE.isPublic ? "checked" : ""} />
                    <span>Make public</span>
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
        const pub = el.querySelector("#bb-add-public");
        if (ta) ADD_FORM_STATE.text = ta.value;
        if (sel) ADD_FORM_STATE.language = sel.value;
        if (pub) ADD_FORM_STATE.isPublic = pub.checked;
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

    el.querySelector("#bb-add-public")?.addEventListener("change", (e) => {
        ADD_FORM_STATE.isPublic = e.target.checked;
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

    el.innerHTML = `<span class="bb-muted">⏳ Generating…</span>`;

    const prompt = `You are a Japanese language teacher. Generate 2 example sentences using the word ${subject.characters}.
For each sentence use this exact format:
SENTENCE: [japanese]
READING: [furigana/romaji]
ENGLISH: [translation]
---`;

    try {
        const res = await fetch(`${BUNBEE_API}/api/geminiproxy/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({ prompt }),
        });

        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const sentences = parseSentences(data.text);

        if (!sentences.length) {
            el.innerHTML = `<span class="bb-muted">Could not parse sentences. Try again.</span>`;
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
                    🔖 Save to Bunbee
                </button>
            </div>
        `).join("") + `<button class="bb-btn bb-btn--secondary" id="bb-regenerate-btn">🔄 Regenerate</button>`;

        el.querySelectorAll(".bb-save-sentence-btn").forEach((btn) => {
            btn.addEventListener("click", () => handleSaveSentence(btn));
        });

        el.querySelector("#bb-regenerate-btn")?.addEventListener("click", handleGenerate);

    } catch (e) {
        el.innerHTML = `
            <span class="bb-muted">Error: ${e.message}</span>
            <button class="bb-btn" id="bb-generate-btn">Try again</button>
        `;
        el.querySelector("#bb-generate-btn")?.addEventListener("click", handleGenerate);
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
        btn.textContent = isSaved ? "🔖 Save" : "✅ Saved";
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
            btn.textContent = "✅ Saved!";
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

    // Reset sentences section
    const sentencesEl = document.getElementById("bb-sentences-content");
    if (sentencesEl) {
        sentencesEl.innerHTML = `<button class="bb-btn" id="bb-generate-btn">Generate sentences</button>`;
        sentencesEl.querySelector("#bb-generate-btn")?.addEventListener("click", handleGenerate);
    }

    // If the user had the inline "new mnemonic" form open for the previous
    // subject, discard it: the text & type were specific to that item.
    ADD_FORM_STATE.open = false;
    ADD_FORM_STATE.text = "";
    ADD_FORM_STATE.error = "";

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