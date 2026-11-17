/* ============================================================
   LOGIN.JS  -  Sign in, Create account, Forgot password,
   Set new password (after the email link) and timeout messages.
   New accounts always get role = 'user' (set by the database
   trigger, the browser can never choose a role).
============================================================ */

function showMsg(message, type = "danger") {
    const box = $("authMsg");
    box.className = `alert alert-${type} py-2 small`;
    box.textContent = message;
    box.style.display = message ? "block" : "none";
}

/* views: login | signup | forgot | reset */
const VIEWS = {
    login:  { form: "loginForm",  title: "Sign in",          sub: "Use your email and password" },
    signup: { form: "signupForm", title: "Create account",   sub: "Register to start tracking your expenses" },
    forgot: { form: "forgotForm", title: "Forgot password",  sub: "We will email you a reset link" },
    reset:  { form: "resetForm",  title: "Set new password", sub: "Choose a new password for your account" }
};

function showView(view) {
    Object.entries(VIEWS).forEach(([name, v]) => {
        $(v.form).style.display = name === view ? "" : "none";
    });
    $("authTitle").textContent = VIEWS[view].title;
    $("authSub").textContent = VIEWS[view].sub;
    // sign in / create account tabs only on those two views
    document.querySelector(".auth-tabs").style.display =
        (view === "login" || view === "signup") ? "" : "none";
    $("tabLogin").classList.toggle("active", view !== "signup");
    $("tabSignup").classList.toggle("active", view === "signup");
    showMsg("");
}
const switchTab = (mode) => showView(mode === "signup" ? "signup" : "login");

async function goIfProfile(userId) {
    const profile = await fetchProfile(userId);
    if (!profile) throw new Error("Your account has no profile yet. Please contact the admin.");
    location.replace("index.html");
}

/* "Resend in 45s" countdown on a button */
function startCooldown(btn, seconds) {
    const original = btn.innerHTML;
    let left = seconds;
    btn.disabled = true;
    btn.textContent = `Resend in ${left}s`;
    const timer = setInterval(() => {
        left -= 1;
        if (left <= 0) { clearInterval(timer); btn.disabled = false; btn.innerHTML = original; }
        else btn.textContent = `Resend in ${left}s`;
    }, 1000);
}

document.addEventListener("DOMContentLoaded", async () => {

    /* ---- what did the URL bring us here for? ---- */
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const isRecoveryLink = hash.get("type") === "recovery";
    const linkError = hash.get("error_description") || hash.get("error");
    let recoveryActive = false;

    // Supabase fires this when the user opens the reset link from the email
    db.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
            recoveryActive = true;
            showView("reset");
        }
    });

    const { data: { session } } = await db.auth.getSession();

    if (linkError) {
        history.replaceState(null, "", location.pathname);
        showView("forgot");
        showMsg("This reset link is invalid or has expired. Please request a new one.");
    } else if (isRecoveryLink || recoveryActive) {
        history.replaceState(null, "", location.pathname);
        if (session) showView("reset");
        else { showView("forgot"); showMsg("This reset link has expired. Please request a new one."); }
    } else if (session) {
        // Already signed in AND still inside the allowed time? Go straight to the app.
        if (sessionIsFresh()) {
            try { return await goIfProfile(session.user.id); }
            catch (e) { /* no profile -> fall through to sign out */ }
        }
        wipeLocalSession();
        clearSessionKeys();
        try { await db.auth.signOut(); } catch (e) { /* ignore */ }
    }

    /* ---- messages from redirects ---- */
    const reason = query.get("reason");
    if (reason === "timeout") showMsg("You were signed out because you were inactive. Please sign in again.", "warning");
    else if (reason === "expired") showMsg("Your session expired for security. Please sign in again.", "warning");
    if (query.get("error") === "noprofile") showMsg("Your account has no profile yet. Please contact the admin.");

    /* ---- navigation ---- */
    $("tabLogin").addEventListener("click", () => showView("login"));
    $("tabSignup").addEventListener("click", () => showView("signup"));
    $("forgotLink").addEventListener("click", (e) => {
        e.preventDefault();
        $("fpEmail").value = $("email").value.trim();     // reuse what was typed
        showView("forgot");
        $("fpEmail").focus();
    });
    $("backToLogin").addEventListener("click", () => showView("login"));

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
            startSessionClock();                                  // start the timeout clock
            try { await goIfProfile(data.user.id); }
            catch (e) { clearSessionKeys(); await db.auth.signOut(); throw e; }
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
                startSessionClock();
                return await goIfProfile(data.user.id);
            }

            // email confirmation is ON
            $("signupForm").reset();
            showView("login");
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

    /* ---------- FORGOT PASSWORD: send the reset email ---------- */
    $("forgotForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        showMsg("");

        const email = $("fpEmail").value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) return showMsg("Enter the email you registered with.");

        const btn = $("forgotBtn");
        setBusy(btn, true, "Sending...");
        try {
            const { error } = await db.auth.resetPasswordForEmail(email, {
                redirectTo: new URL("login.html", location.href).href   // this page, opened from the email
            });
            if (error) throw error;

            // Same message whether or not the email exists (does not reveal who has an account)
            setBusy(btn, false);
            showMsg("If this email is registered, a reset link has been sent. Check your inbox and spam folder.", "success");
            startCooldown(btn, 60);

        } catch (error) {
            console.error("Reset email error:", error);
            setBusy(btn, false);
            const text = error.message || "";
            showMsg(/rate limit|too many|security purposes/i.test(text)
                ? "Too many requests. Please wait a minute and try again."
                : text || "Unable to send the reset email.");
        }
    });

    /* ---------- SET NEW PASSWORD (after opening the email link) ---------- */
    $("resetForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        showMsg("");

        const password = $("npPassword").value;
        const confirm = $("npConfirm").value;
        if (password.length < 8) return showMsg("Password must be at least 8 characters.");
        if (password !== confirm) return showMsg("Passwords do not match.");

        const btn = $("resetBtn");
        setBusy(btn, true, "Updating...");
        try {
            const { error } = await db.auth.updateUser({ password });
            if (error) throw error;

            // sign out everywhere so the new password must be used
            try { await db.auth.signOut(); } catch (e) { /* ignore */ }
            wipeLocalSession();
            clearSessionKeys();

            $("resetForm").reset();
            showView("login");
            showMsg("Password updated. Please sign in with your new password.", "success");

        } catch (error) {
            console.error("Update password error:", error);
            const text = error.message || "";
            showMsg(/session missing|not authenticated/i.test(text)
                ? "This reset link has expired. Please request a new one."
                : /different from the old|same as the old/i.test(text)
                ? "Choose a password different from your old one."
                : text || "Unable to update the password.");
        } finally {
            setBusy(btn, false);
        }
    });
});
