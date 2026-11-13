/* ============================================================
   COMMON.JS  -  shared by every page
   Supabase client, navbar (with logged-in user + logout),
   toast, confirm dialog, helpers
   NOTE: load order on every page:
         config.js -> common.js -> auth.js -> page script
============================================================ */

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIES = [
    "Electric Things", "Plumbing Things", "Mesthiry", "Breakfast",
    "Lunch", "Dinner", "Transport", "Accommodation", "Other"
];

/* ---------- small helpers ---------- */
const $ = (id) => document.getElementById(id);

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function money(n) {
    return "₹" + Number(n || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
}
function pad(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return ymd(new Date()); }
function nowTimeStr() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDate(s) {
    if (!s) return "-";
    const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(s) {
    if (!s) return "-";
    const [h, m] = String(s).split(":").map(Number);
    const d = new Date(); d.setHours(h, m || 0);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function initial(name) { return (String(name || "?").trim()[0] || "?").toUpperCase(); }
function fillSelect(select, items, placeholder, selected) {
    if (!select) return;
    const keep = selected ?? select.value;
    select.innerHTML = (placeholder !== null ? `<option value="">${esc(placeholder)}</option>` : "") +
        items.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if (keep && items.includes(keep)) select.value = keep;
}
function setBusy(btn, busy, text) {
    if (!btn) return;
    if (busy) {
        btn.dataset.html = btn.innerHTML; btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${text || "Please wait..."}`;
    } else {
        btn.disabled = false;
        if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
    }
}

/* ---------- load ALL rows (Supabase returns at most 1000 per request) ----------
   usage: await fetchAllRows(() => db.from("expenses").select("*").order("id"))
   The query MUST have a stable .order() so pages do not overlap.            */
async function fetchAllRows(buildQuery, pageSize = 1000) {
    const rows = [];
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await buildQuery().range(from, from + pageSize - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
    }
    return rows;
}

/* ---------- page loader ----------
   The loader markup (#pageLoader) sits at the top of every page's <body>.
   It stays for at least LOADER_MIN_MS, then fades out and is removed. */
const LOADER_MIN_MS = 250;
function hidePageLoader() {
    const el = document.getElementById("pageLoader");
    if (!el || el.dataset.done) return;
    el.dataset.done = "1";
    const wait = Math.max(0, LOADER_MIN_MS - performance.now());   // time since the page started opening
    setTimeout(() => {
        el.classList.add("hide");
        setTimeout(() => el.remove(), 250);
    }, wait);
}

/* ---------- toast ---------- */
function toast(message, type = "success") {
    let wrap = $("toastWrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.id = "toastWrap"; wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    const icon = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" }[type] || "fa-circle-info";
    const el = document.createElement("div");
    el.className = `app-toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${esc(message)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add("hide"); setTimeout(() => el.remove(), 320); }, 3200);
}
const showSuccess = (m) => toast(m, "success");
const showError = (m) => toast(m, "error");

/* ---------- confirm dialog (returns Promise<boolean>) ---------- */
function confirmDialog(message, okText = "Delete", variant = "danger") {
    return new Promise((resolve) => {
        let el = $("confirmModal");
        if (!el) {
            el = document.createElement("div");
            el.className = "modal fade"; el.id = "confirmModal"; el.tabIndex = -1;
            el.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-sm"><div class="modal-content">
              <div class="modal-body text-center p-4">
                <div id="confirmIcon" class="stat-icon mx-auto mb-3" style="width:58px;height:58px"><i class="fa-solid fa-triangle-exclamation fa-lg"></i></div>
                <p id="confirmMsg" class="mb-4 fw-semibold"></p>
                <div class="d-flex gap-2"><button class="btn btn-soft flex-fill" data-bs-dismiss="modal">Cancel</button>
                <button class="btn flex-fill" id="confirmOk"></button></div>
              </div></div></div>`;
            document.body.appendChild(el);
        }
        $("confirmMsg").textContent = message;
        $("confirmOk").textContent = okText;
        $("confirmOk").className = `btn flex-fill ${variant === "danger" ? "btn-danger" : "btn-primary"}`;
        $("confirmIcon").className = `stat-icon mx-auto mb-3 ${variant === "danger" ? "red" : "green"}`;
        $("confirmIcon").innerHTML = `<i class="fa-solid ${variant === "danger" ? "fa-triangle-exclamation" : "fa-circle-check"} fa-lg"></i>`;
        const modal = bootstrap.Modal.getOrCreateInstance(el);
        let result = false;
        $("confirmOk").onclick = () => { result = true; modal.hide(); };
        el.addEventListener("hidden.bs.modal", () => resolve(result), { once: true });
        modal.show();
    });
}

/* ============================================================
   NAVBAR  (one place - appears on every protected page)
   Shows the logged-in name, a role badge and a Logout button.
============================================================ */
const NAV_ITEMS = [
    { page: "index",     href: "index.html",           icon: "fa-circle-plus",         label: "Add Expense",     short: "Add" },
    { page: "expense",   href: "expense.html",         icon: "fa-table-list",          label: "View Expenses",   short: "Expenses" },
    { page: "dashboard", href: "dashboard.html",       icon: "fa-chart-column",        label: "Dashboard",       short: "Dashboard" },
    { page: "shared",    href: "shared-expenses.html", icon: "fa-hand-holding-dollar", label: "Shared Expenses", short: "Shared" }
];

function renderNavbar(profile) {
    if ($("appNavbar")) return;
    const current = document.body.dataset.page;
    const links = (cls) => NAV_ITEMS.map(i =>
        `<a href="${i.href}" class="${i.page === current ? "active" : ""}"><i class="fa-solid ${i.icon}"></i>${cls === "tab" ? i.short : i.label}</a>`).join("");

    const roleLabel = profile?.role === "admin" ? "Admin" : "User";
    const html = `
    <div id="appNavbar">
    <nav class="app-nav"><div class="container inner">
        <a class="brand" href="index.html">
            <span class="brand-badge"><i class="fa-solid fa-indian-rupee-sign"></i></span>
            <span>Daily Expense</span>
        </a>
        <div class="nav-links">${links("top")}</div>
        <div class="d-flex align-items-center gap-2">
            <div class="date-pill show-mobile d-none d-md-flex"><i class="fa-regular fa-calendar"></i><span id="currentDate"></span></div>
            <span class="tag" title="${esc(profile?.full_name || "")}">
                <i class="fa-solid ${profile?.role === "admin" ? "fa-user-shield" : "fa-user"} me-1"></i>
                ${esc(profile?.full_name || "")} <small class="text-muted">(${roleLabel})</small>
            </span>
            <button type="button" class="btn btn-soft btn-sm" id="logoutBtn" title="Sign out">
                <i class="fa-solid fa-right-from-bracket"></i><span class="d-none d-sm-inline ms-1">Logout</span>
            </button>
        </div>
    </div></nav>
    <div class="tabbar">${links("tab")}</div>
    </div>`;
    document.body.insertAdjacentHTML("afterbegin", html);

    const d = $("currentDate");
    if (d) d.textContent = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    $("logoutBtn").addEventListener("click", async () => {
        await db.auth.signOut();
        location.replace("login.html");
    });
}

/* Render the navbar once the session + profile are confirmed */
document.addEventListener("DOMContentLoaded", async () => {
    if (document.body.dataset.page === "login") { hidePageLoader(); return; }

    if (!window.authReady) {
        hidePageLoader();
        console.error("auth.js is not loaded on this page. Add <script src=\"auth.js\"></script> after common.js.");
        showError("Login check missing on this page. Add auth.js.");
        return;
    }

    const profile = await window.authReady;
    renderNavbar(profile);
    hidePageLoader();
});

/* ---------- creators ----------
   Creator is no longer chosen manually: it always comes from the
   logged-in user's profile (currentProfile.full_name).
   fetchCreators() is kept only for the filter / edit dropdowns on
   expense.html. Admins get every profile name, users get their own. */
async function fetchCreators() {
    try {
        const { data, error } = await db.from("profiles").select("full_name").order("full_name");
        if (error) throw error;
        return (data || []).map(r => r.full_name).filter(Boolean);
    } catch (e) {
        console.warn("Unable to load creators:", e.message || e);
        return currentProfile ? [currentProfile.full_name] : [];
    }
}

/* ---------- expense types (shared by index + expense pages) ---------- */
async function fetchExpenseTypes() {
    const { data, error } = await db.from("expense_types").select("name").order("name");
    if (error) throw error;
    return (data || []).map(r => r.name);
}
