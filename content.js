// ─── Bunbee content script ────────────────────────────────────────────────────
// Injects a panel below each review card showing mnemonics and a sentence
// generator for the current subject.

const BUNBEE_API = "https://api.bunbee.cc";
const BUNBEE_WEB = "https://bunbee.cc";
const PANEL_ID = "bunbee-panel";

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

// ─── Panel HTML ───────────────────────────────────────────────────────────────

function createPanel() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    // Build the icon as a real <img> with src pointing at the extension's
    // packaged asset. We don't use a `data:` URI inside innerHTML because
    // WaniKani's CSP (`img-src 'self'`) does not include `data:` and would
    // block it; extension URLs (`moz-extension://`, `chrome-extension://`)
    // are allowed for content-script-injected images.
    panel.innerHTML = `
        <div class="bb-header">
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADmUlEQVQ4T22TbUxbVRjH/6e3t/deaGlKBLaWVSiClI2GdUtmY9mIkElY2DTiiBqJ2bR8WaImfjNGNqNGPy3GxbjEmhlA98EP2lAWFjcMboSY1owMViZWxsvWl7W19AXuvb33emjcB41PcpKT5zn//3OeX84hR12uyoSUGeF4rtbe6Bjt6X1henh4WMb/xMjIiG7h1s3upcidV4iixIyVzGfE22635ETlJw1qh4HjC1bbnjM/TP78DSFE+6+H96BzKJ/LXRQl0UB0ujm9nnmN7Bx60eMRkhBtf20mj/J6/nXCqCe5KmVdljl2p86yopyKlZoVSQoIHPdJpclyxayw8UAoVCwbPAqfr7/i5vVfz7J6pr6l1RY28bo6huFIfktLLixGD8myuuRw7j4XCISKjzRlA03TyCFnU7Olhh10tVU919BYt9/ucJEqoQidmsNmQcXKShzr66lwaD4b2Cwql2dDdyM7Y5YNXh085iRS7OMer9Dt9ViN9Q026DgroNBGUhKgOFRZxv37Wcz9li5+9+PG1dUH0rnQ/HKYnDp+3CQZMqN9h/V9J3qter6CB1VDA/XWGQC1BFLK01sqtBWBKCqYmsnIX41FJ9IZvEV6vK6hvc3spY/ebYeBN6BEzzEsA4bqNU1Hm9OEKtF8CUpJA0sL25KGTy9EtCvXY6eIZ//j02+ebjky0N+I2XACn/uXMHCiCc8fa6QOVFwSy7y+D67BP3YX773djqfcNQhcXYf/23sBcvigI3n2TOtjndY63IikMHYjiq4uOw50WJBKFkCIimoLj7lwGlPXVnH6yBPobKvBzFoC5y//sUyedjfce+elZnu/2Qq5mkVsl4RauxGra1ncvpPeIQFniwX1NhMSDzaxJ8ZCHy9h4uEG/DOpeTpC0yWv2zz0/htt4M0CYKIQDXQpIra2pTJMgWcoC7qjQFFQUHiYx/nxCGYXyRekt9Pt4gR1+mQ3axnos4IRKgHeBOgFKhChMSwVq4CYg0Z5KCqLqV8yuDi6Es8X2UHi8/nYjZXIy0ROf9jfJezue6ZWZzZxMAgCNasoA1REEbK4jXy2gOC1hDoeTMcJqfrAecDrLz+kYDDIjX994dlo9HdfrVne595XtevJljrObKRlqYh0VsLy2tb23K1sPJbCbaPR+GWFxT41OTkp/usveDx7q3OJZKskK03VFktHSVUdDNGVFFX5M5/PLzAMu9zQ6licmKAz/BN/Ay2UiQF0vyrSAAAAAElFTkSuQmCC" class="bb-logo" alt="Bunbee" />
            <span class="bb-title">Bunbee</span>
            <button class="bb-toggle" title="Toggle panel">▼</button>
        </div>
        <div class="bb-body">
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
        const body = panel.querySelector(".bb-body");
        const wasCollapsed = body.classList.toggle("bb-collapsed");
        panel.querySelector(".bb-toggle").textContent = wasCollapsed ? "▲" : "▼";
    });

    // Generate button
    panel.querySelector("#bb-generate-btn").addEventListener("click", () => {
        handleGenerate();
    });

    // "+ Add mnemonic" — opens the web app's "new mnemonic" page for the
    // current subject in a new tab. We resolve the subjectId at click time
    // (instead of at render time) so it always reflects the active item.
    panel.querySelector("#bb-add-mnemonic-btn").addEventListener("click", () => {
        const subject = getCurrentSubject();
        const url = subject?.subjectId
            ? `${BUNBEE_WEB}/mnemonics/subject/${subject.subjectId}/new`
            : `${BUNBEE_WEB}/mnemonics/new`;
        window.open(url, "_blank", "noopener,noreferrer");
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

        // We always render the tab structure — even when there are no
        // mnemonics — so the user sees the "My / Public" UI plus an empty
        // state inside each panel, instead of a single "no mnemonics" line.
        const byScore = (a, b) => (b.score ?? 0) - (a.score ?? 0);
        const mine = mnemonics.filter((m) => m.isOwn).sort(byScore);
        const community = mnemonics.filter((m) => !m.isOwn).sort(byScore);

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

function onSubjectChange() {
    const subject = getCurrentSubject();
    if (!subject?.subjectId || subject.subjectId === lastSubjectId) return;

    lastSubjectId = subject.subjectId;
    console.log("[Bunbee] Subject changed:", subject);

    // Reset sentences section
    const sentencesEl = document.getElementById("bb-sentences-content");
    if (sentencesEl) {
        sentencesEl.innerHTML = `<button class="bb-btn" id="bb-generate-btn">Generate sentences</button>`;
        sentencesEl.querySelector("#bb-generate-btn")?.addEventListener("click", handleGenerate);
    }

    loadMnemonics(subject.subjectId);
}

const observer = new MutationObserver(() => {
    injectPanel();
    onSubjectChange();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
    injectPanel();
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