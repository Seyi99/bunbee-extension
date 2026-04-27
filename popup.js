const BUNBEE_API = "https://api.bunbee.cc";
const root = document.getElementById("root");

// Inline Material Symbols Rounded "check_circle" (filled). We embed the SVG
// instead of loading the Google Fonts stylesheet because MV3 popups have a
// strict default CSP that blocks fonts.googleapis.com.
const CHECK_CIRCLE_SVG = `<svg width="16" height="16" viewBox="0 -960 960 960" fill="#4a7c3f" aria-hidden="true" style="vertical-align:middle;flex-shrink:0"><path d="m424-408-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-408Zm56 328q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>`;

function renderLogin(errorMsg = "") {
    root.innerHTML = `
        <label for="wk-token">WaniKani API Token</label>
        <input type="password" id="wk-token" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        <button id="login-btn">Connect</button>
        ${errorMsg ? `<div class="status err">${errorMsg}</div>` : ""}
        <div class="status">
            <a href="https://www.wanikani.com/settings/personal_access_tokens" target="_blank" style="color:#4a7c3f">
                Get your token here
            </a>
        </div>
    `;

    document.getElementById("login-btn").addEventListener("click", handleLogin);
    document.getElementById("wk-token").addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleLogin();
    });
}

function renderLoggedIn(username) {
    root.innerHTML = `
        <div class="logged-in">${CHECK_CIRCLE_SVG} <span>Logged in as <strong>${username}</strong></span></div>
        <button class="logout-btn" id="logout-btn">Log out</button>
    `;
    document.getElementById("logout-btn").addEventListener("click", handleLogout);
}

async function handleLogin() {
    const token = document.getElementById("wk-token").value.trim();
    if (!token) return;

    const btn = document.getElementById("login-btn");
    btn.textContent = "Connecting…";
    btn.disabled = true;

    try {
        const res = await fetch(`${BUNBEE_API}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ waniKaniToken: token }),
        });

        if (!res.ok) throw new Error("Invalid token or server error.");
        const data = await res.json();

        // Persist the WK token alongside the Bunbee JWT. The content script
        // needs it to call https://api.wanikani.com/v2/subjects/{id} for
        // readings/meanings (the same endpoint the web app uses).
        chrome.storage.local.set({
            bunbee_jwt: data.token,
            bunbee_username: data.username,
            wk_token: token,
        }, () => {
            renderLoggedIn(data.username);
        });

    } catch (e) {
        renderLogin(e.message);
    }
}

function handleLogout() {
    chrome.storage.local.remove(["bunbee_jwt", "bunbee_username", "wk_token"], () => {
        renderLogin();
    });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

chrome.storage.local.get(["bunbee_jwt", "bunbee_username"], (result) => {
    if (result.bunbee_jwt && result.bunbee_username) {
        renderLoggedIn(result.bunbee_username);
    } else {
        renderLogin();
    }
});
