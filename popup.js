const BUNBEE_API = "https://api.bunbee.cc";
const root = document.getElementById("root");

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
        <div class="logged-in">✅ Logged in as <strong>${username}</strong></div>
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

        chrome.storage.local.set({
            bunbee_jwt: data.token,
            bunbee_username: data.username,
        }, () => {
            renderLoggedIn(data.username);
        });

    } catch (e) {
        renderLogin(e.message);
    }
}

function handleLogout() {
    chrome.storage.local.remove(["bunbee_jwt", "bunbee_username"], () => {
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
