/* ============================================================
   AUTH.JS  -  load AFTER config.js and common.js on every page
   - login page: nothing runs automatically
   - every other page: checks the session, loads the profile
     (full_name + role) and exposes it as window.authReady
============================================================ */

let currentUser = null;      // Supabase auth user
let currentProfile = null;   // { id, full_name, role }

const isAdmin = () => currentProfile?.role === "admin";

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
        location.replace("login.html");
        return new Promise(() => {});          // stop the page from continuing
    }

    let profile = null;
    try { profile = await fetchProfile(session.user.id); }
    catch (e) { console.error("Profile error:", e); }

    if (!profile) {
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
    document.documentElement.style.visibility = "";   // show page
    return profile;
}

async function logout() {
    await db.auth.signOut();
    location.replace("login.html");
}

/* If the session ends in another tab, send this tab to login too */
db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && document.body.dataset.page !== "login") {
        location.replace("login.html");
    }
});

/* Auto-start on protected pages (hide page until checked) */
if (document.body.dataset.page !== "login") {
    document.documentElement.style.visibility = "hidden";
    window.authReady = requireAuth({
        adminOnly: document.body.dataset.role === "admin"
    });
}
