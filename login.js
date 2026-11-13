/* ============================================================
   LOGIN.JS  -  Sign in + Create account
   New accounts always get role = 'user' (set by the database
   trigger, the browser can never choose a role).
============================================================ */

function showMsg(message, type = "danger") {
    const box = $("authMsg");
    box.className = `alert alert-${type} py-2 small`;
    box.textContent = message;
    box.style.display = message ? "block" : "none";
}

function switchTab(mode) {
    const signup = mode === "signup";
    $("loginForm").style.display = signup ? "none" : "";
    $("signupForm").style.display = signup ? "" : "none";
    $("tabLogin").classList.toggle("active", !signup);
    $("tabSignup").classList.toggle("active", signup);
    $("authTitle").textContent = signup ? "Create account" : "Sign in";
    $("authSub").textContent = signup ? "Register to start tracking your expenses" : "Use your email and password";
    showMsg("");
}

async function goIfProfile(userId) {
    const profile = await fetchProfile(userId);
    if (!profile) throw new Error("Your account has no profile yet. Please contact the admin.");
    location.replace("index.html");
}

document.addEventListener("DOMContentLoaded", async () => {

    // Already signed in? Go straight to the app.
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        try { return await goIfProfile(session.user.id); }
        catch (e) { await db.auth.signOut(); }
    }

    if (new URLSearchParams(location.search).get("error") === "noprofile") {
        showMsg("Your account has no profile yet. Please contact the admin.");
    }

    $("tabLogin").addEventListener("click", () => switchTab("login"));
    $("tabSignup").addEventListener("click", () => switchTab("signup"));

    document.querySelectorAll(".pw-toggle").forEach(btn => btn.addEventListener("click", () => {
        const input = $(btn.dataset.target);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.innerHTML = `<i class="fa-regular ${show ? "fa-eye-slash" : "fa-eye"}"></i>`;
    }));

    /* ---------- SIGN IN ---------- */
    $("loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        showMsg("");

        const email = $("email").value.trim();
        const password = $("password").value;
        if (!email || !password) return showMsg("Enter your email and password.");

        const btn = $("loginBtn");
        setBusy(btn, true, "Signing in...");
        try {
            const { data, error } = await db.auth.signInWithPassword({ email, password });
            if (error) throw error;
            try { await goIfProfile(data.user.id); }
            catch (e) { await db.auth.signOut(); throw e; }
        } catch (error) {
            console.error("Login error:", error);
            const text = error.message || "";
            showMsg(/invalid login credentials/i.test(text) ? "Wrong email or password."
                  : /email not confirmed/i.test(text) ? "Please confirm your email first. Check your inbox."
                  : text || "Unable to sign in.");
            setBusy(btn, false);
        }
    });

    /* ---------- CREATE ACCOUNT ---------- */
    $("signupForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        showMsg("");

        const fullName = $("suName").value.trim().replace(/\s+/g, " ");
        const email = $("suEmail").value.trim();
        const password = $("suPassword").value;
        const confirm = $("suConfirm").value;

        if (fullName.length < 2) return showMsg("Enter your full name.");
        if (!email) return showMsg("Enter your email.");
        if (password.length < 8) return showMsg("Password must be at least 8 characters.");
        if (password !== confirm) return showMsg("Passwords do not match.");

        const btn = $("signupBtn");
        setBusy(btn, true, "Creating account...");
        try {
            const { data, error } = await db.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }   // trigger copies this into profiles
            });
            if (error) throw error;

            // Email already registered (Supabase returns a user with no identities)
            if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                throw new Error("This email is already registered. Please sign in.");
            }

            if (data.session) {                              // email confirmation is OFF
                return await goIfProfile(data.user.id);
            }

            // email confirmation is ON
            $("signupForm").reset();
            switchTab("login");
            $("email").value = email;
            showMsg("Account created. Check your email and click the confirmation link, then sign in.", "success");

        } catch (error) {
            console.error("Signup error:", error);
            const text = error.message || "";
            showMsg(/database error|duplicate|unique/i.test(text)
                ? "This name is already taken. Please use a different full name."
                : text || "Unable to create account.");
        } finally {
            setBusy(btn, false);
        }
    });
});
