/* ============================================================
   AUTH.JS  -  load AFTER config.js and common.js on every page
   - login page: only the helper functions are used
   - every other page: checks the session, loads the profile
     (full_name + role), exposes it as window.authReady and
     starts the SESSION TIMEOUT guard (privacy)
============================================================ */

let currentUser = null;      // Supabase auth user
let currentProfile = null;   // { id, full_name, role }

const isAdmin = () => currentProfile?.role === "admin";

/* ------------------------------------------------------------
   SESSION SETTINGS  (change these numbers as you like)
------------------------------------------------------------ */
const SESSION_IDLE_MINUTES = 15;   // sign out after this much inactivity
const SESSION_WARN_SECONDS = 60;   // show "Still there?" this many seconds before
const SESSION_MAX_HOURS    = 6;   // always sign out after this long, even if active

const KEY_ACTIVITY = "expense_last_activity";
const KEY_LOGIN_AT = "expense_login_at";

let autoLoggingOut = false;

/* ---------- safe localStorage helpers ---------- */
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

function clearSessionKeys() { lsDel(KEY_ACTIVITY); lsDel(KEY_LOGIN_AT); }

/* removes every Supabase token from this browser (works even when offline) */
function wipeLocalSession() {
    try {
        Object.keys(localStorage)
            .filter(k => /^sb-.*-auth-token/.test(k))
            .forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
}

/* call right after a successful sign in */
function startSessionClock() {
    const now = Date.now();
    lsSet(KEY_LOGIN_AT, now);
    lsSet(KEY_ACTIVITY, now);
}
function ensureSessionClock() {
    const now = Date.now();
    if (!lsGet(KEY_LOGIN_AT)) lsSet(KEY_LOGIN_AT, now);
    if (!lsGet(KEY_ACTIVITY)) lsSet(KEY_ACTIVITY, now);
}

/* how much time is left? */
function sessionState() {
    const now = Date.now();
    const last = Number(lsGet(KEY_ACTIVITY)) || now;
    const loginAt = Number(lsGet(KEY_LOGIN_AT)) || now;
    const idleLeft = SESSION_IDLE_MINUTES * 60000 - (now - last);
    const maxLeft = SESSION_MAX_HOURS * 3600000 - (now - loginAt);
    const status = maxLeft <= 0 ? "max" : idleLeft <= 0 ? "idle" : "ok";
    return { status, idleLeft, maxLeft };
}
const sessionIsFresh = () => sessionState().status === "ok";

/* ------------------------------------------------------------
   PROFILE + LOGIN CHECK
------------------------------------------------------------ */
async function fetchProfile(userId) {
    const { data, error } = await db
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

/* Redirects to login.html when there is no valid session.
   Resolves with the profile when everything is fine. */
async function requireAuth({ adminOnly = false } = {}) {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        clearSessionKeys();
        location.replace("login.html");
        return new Promise(() => {});          // stop the page from continuing
    }

    // session older than the allowed idle / maximum time -> sign out
    ensureSessionClock();
    const state = sessionState();
    if (state.status !== "ok") {
        return forceLogout(state.status === "max" ? "expired" : "timeout");
    }

    let profile = null;
    try { profile = await fetchProfile(session.user.id); }
    catch (e) { console.error("Profile error:", e); }

    if (!profile) {
        clearSessionKeys();
        await db.auth.signOut();
        location.replace("login.html?error=noprofile");
        return new Promise(() => {});
    }
    if (adminOnly && profile.role !== "admin") {
        location.replace("index.html");
        return new Promise(() => {});
    }

    currentUser = session.user;
    currentProfile = profile;
    startSessionGuard();
    document.documentElement.style.visibility = "";   // show page
    return profile;
}

/* normal logout (button) */
async function logout() {
    autoLoggingOut = true;
    clearSessionKeys();
    try { await db.auth.signOut(); } catch (e) { /* ignore */ }
    wipeLocalSession();
    location.replace("login.html");
}

/* automatic logout (timeout) - login page shows the reason */
async function forceLogout(reason) {
    if (autoLoggingOut) return new Promise(() => {});
    autoLoggingOut = true;
    clearSessionKeys();
    try { await db.auth.signOut(); } catch (e) { /* ignore */ }
    wipeLocalSession();
    location.replace("login.html?reason=" + encodeURIComponent(reason));
    return new Promise(() => {});
}

/* If the session ends in another tab, send this tab to login too */
db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
        clearSessionKeys();
        if (document.body.dataset.page !== "login" && !autoLoggingOut) {
            location.replace("login.html");
        }
    }
});

/* ------------------------------------------------------------
   SESSION GUARD  (idle timeout + "Still there?" warning)
------------------------------------------------------------ */
let guardStarted = false;
let warnEl = null;
let lastWrite = 0;

function markActive() {
    if (warnEl) return;                       // while the warning is open only the button counts
    const now = Date.now();
    if (now - lastWrite > 5000) {             // write at most every 5 seconds
        lastWrite = now;
        lsSet(KEY_ACTIVITY, now);
    }
}

function showWarning(seconds) {
    if (!warnEl) {
        warnEl = document.createElement("div");
        warnEl.id = "sessionWarn";
        warnEl.style.cssText =
            "position:fixed;inset:0;z-index:100000;background:rgba(17,24,39,.55);" +
            "display:flex;align-items:center;justify-content:center;padding:1rem;visibility:visible";
        warnEl.innerHTML = `
            <div style="background:#fff;border-radius:16px;max-width:380px;width:100%;padding:1.5rem;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.3)">
                <div style="font-size:2rem;color:#f59e0b"><i class="fa-solid fa-hourglass-half"></i></div>
                <h5 style="font-weight:700;margin:.5rem 0">Are you still there?</h5>
                <p style="color:#4b5563;margin-bottom:1rem">For your privacy you will be signed out in
                   <b id="sessionWarnSecs"></b> seconds.</p>
                <div style="display:flex;gap:.5rem">
                    <button type="button" id="sessionLogoutNow" class="btn btn-soft flex-fill">Sign out</button>
                    <button type="button" id="sessionStay" class="btn btn-primary flex-fill">Stay signed in</button>
                </div>
            </div>`;
        document.body.appendChild(warnEl);
        document.getElementById("sessionStay").addEventListener("click", () => {
            lsSet(KEY_ACTIVITY, Date.now());
            lastWrite = Date.now();
            hideWarning();
        });
        document.getElementById("sessionLogoutNow").addEventListener("click", logout);
    }
    document.getElementById("sessionWarnSecs").textContent = seconds;
}

function hideWarning() {
    if (warnEl) { warnEl.remove(); warnEl = null; }
}

function sessionTick() {
    if (autoLoggingOut) return;
    const s = sessionState();
    if (s.status === "max") return forceLogout("expired");
    if (s.status === "idle") return forceLogout("timeout");
    if (s.idleLeft <= SESSION_WARN_SECONDS * 1000) showWarning(Math.ceil(s.idleLeft / 1000));
    else hideWarning();                       // activity in another tab
}

function startSessionGuard() {
    if (guardStarted) return;
    guardStarted = true;

    ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"].forEach(ev =>
        window.addEventListener(ev, markActive, { passive: true, capture: true }));

    setInterval(sessionTick, 1000);

    // coming back to the tab / app after a long time -> check at once
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") sessionTick();
    });

    // back button must never show a cached private page after logout
    window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });
}

/* Auto-start on protected pages (hide page until checked) */
if (document.body.dataset.page !== "login") {
    document.documentElement.style.visibility = "hidden";
    window.authReady = requireAuth({
        adminOnly: document.body.dataset.role === "admin"
    });
}
