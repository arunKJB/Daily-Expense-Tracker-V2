/* =========================================================
   INDEX.JS - DAILY EXPENSE TRACKER
   Manual save + Voice batch save + Quantity support
   Creator always = logged-in user's profile name
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    // Wait for login check (auth.js). Redirects to login.html if signed out.
    const profile = await window.authReady;

    // Creator is locked to the logged-in user
    $("creator").value = profile.full_name;
    $("creator").readOnly = true;

    fillSelect($("category"), CATEGORIES, "Select category");

    $("expenseDate").value = todayStr();
    $("expenseTime").value = nowTimeStr();

    if ($("quantity")) {
        $("quantity").value = "1";
    }

    await Promise.all([
        loadTypes(),
        loadSerial()
    ]);

    setupTypeModal();

    $("expenseForm").addEventListener("submit", async event => {
        event.preventDefault();
        await saveExpense();
    });

});


/* =========================================================
   SERIAL NUMBER
   (users count only their own rows; admin counts all)
========================================================= */

async function loadSerial() {

    try {
        const { count, error } = await db
            .from("expenses")
            .select("id", { count: "exact", head: true });

        if (error) throw error;

        $("serialNo").textContent = (count || 0) + 1;

    } catch (error) {
        console.error("Serial number error:", error);
        $("serialNo").textContent = "1";
    }

}


/* =========================================================
   EXPENSE TYPES
========================================================= */

async function loadTypes(selected = "") {

    try {
        const types = await fetchExpenseTypes();

        fillSelect(
            $("expenseType"),
            types,
            "Select expense type",
            selected
        );

    } catch (error) {
        console.error("Expense type error:", error);
        $("expenseType").innerHTML =
            '<option value="">Unable to load types</option>';
    }

}


/* =========================================================
   ADD EXPENSE TYPE
========================================================= */

function setupTypeModal() {

    const modal = bootstrap.Modal.getOrCreateInstance(
        $("addExpenseTypeModal")
    );

    $("addExpenseTypeBtn").addEventListener("click", () => {
        $("newExpenseType").value = "";
        modal.show();
        setTimeout(() => $("newExpenseType").focus(), 350);
    });

    async function saveType() {

        const name = $("newExpenseType")
            .value
            .trim()
            .replace(/\s+/g, " ");

        if (!name) {
            return showError("Please enter an expense type.");
        }

        const button = $("saveExpenseTypeBtn");
        setBusy(button, true, "Saving...");

        try {

            const existing = await fetchExpenseTypes();

            if (existing.some(type =>
                type.toLowerCase() === name.toLowerCase()
            )) {
                throw new Error("This expense type already exists.");
            }

            const { error } = await db
                .from("expense_types")
                .insert([{ name }]);

            if (error) throw error;

            await loadTypes(name);
            $("expenseType").value = name;

            modal.hide();
            showSuccess("Expense type added.");

        } catch (error) {
            console.error(error);
            showError(error.message || "Unable to add expense type.");
        } finally {
            setBusy(button, false);
        }

    }

    $("saveExpenseTypeBtn").addEventListener("click", saveType);

    $("newExpenseType").addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            saveType();
        }
    });

}


/* =========================================================
   VALIDATION
========================================================= */

function validateExpense(expense, number = null) {

    const prefix = number === null
        ? ""
        : `Expense ${number}: `;

    if (!expense.creator) {
        throw new Error(prefix + "Your profile name is missing. Please log in again.");
    }

    if (!expense.expense_date) {
        throw new Error(prefix + "Please select the date.");
    }




    if (
        !Number.isFinite(Number(expense.quantity)) ||
        Number(expense.quantity) <= 0
    ) {
        throw new Error(prefix + "Please enter a valid quantity.");
    }

    if (
        !Number.isFinite(Number(expense.amount)) ||
        Number(expense.amount) <= 0
    ) {
        throw new Error(prefix + "Please enter a valid amount.");
    }

}


/* =========================================================
   NORMAL SINGLE EXPENSE SAVE
   creator + user_id always come from the login, never the form
========================================================= */

async function saveExpense() {

    const expense = {

        user_id: currentUser.id,
        creator: currentProfile.full_name,

        expense_date: $("expenseDate").value,
        expense_time: $("expenseTime").value || null,

        expense_type: $("expenseType").value,
        category: $("category").value,
        comment: $("comment").value.trim(),

        quantity: Number($("quantity").value || 1),
        amount: Number($("amount").value)

    };

    try {
        validateExpense(expense);
    } catch (error) {
        return showError(error.message);
    }

    const button = $("submitExpenseBtn");
    setBusy(button, true, "Saving...");

    try {

        const { error } = await db
            .from("expenses")
            .insert([expense]);

        if (error) throw error;

        showSuccess(
            `Saved ${money(expense.amount)} for ${expense.creator}.`
        );

        $("comment").value = "";
        $("amount").value = "";
        $("quantity").value = "1";
        $("expenseTime").value = nowTimeStr();

        await loadSerial();

        $("comment").focus();

    } catch (error) {

        console.error("Save error:", error);
        showError(error.message || "Unable to save expense.");

    } finally {
        setBusy(button, false);
    }

}


/* =========================================================
   VOICE BATCH SAVE
   Every item becomes a separate Supabase row, saved under
   the logged-in user (voice.js calls this function).
========================================================= */

window.saveVoiceExpenseBatch = async function (items) {

    if (!Array.isArray(items) || items.length === 0) {
        showError("No expenses available to save.");
        return false;
    }

    if (!currentUser || !currentProfile) {
        showError("Session expired. Please log in again.");
        return false;
    }

    const creator = currentProfile.full_name;      // never from the form
    const userId = currentUser.id;
    const expenseDate = $("expenseDate").value;
    const expenseTime = $("expenseTime").value || null;

    if (!expenseDate) {
        showError("Please select the expense date.");
        return false;
    }

    let rows;

    try {

        rows = items.map((item, index) => {

            const row = {

                user_id: userId,
                creator,

                expense_date: expenseDate,
                expense_time: expenseTime,

                expense_type: String(item.expense_type || "").trim(),
                category: String(item.category || "").trim(),
                comment: String(item.comment || "").trim(),

                quantity: Number(item.quantity || 1),
                amount: Number(item.amount)

            };

            validateExpense(row, index + 1);

            return row;

        });

    } catch (error) {
        showError(error.message);
        return false;
    }

    try {

        // One object in the array = one separate expense row.
        const { error } = await db
            .from("expenses")
            .insert(rows);

        if (error) throw error;

        const total = rows.reduce(
            (sum, row) => sum + row.amount,
            0
        );

        await loadSerial();

        $("expenseTime").value = nowTimeStr();

        showSuccess(
            `${rows.length} expenses saved successfully. Total: ${money(total)}`
        );

        return true;

    } catch (error) {

        console.error("Voice batch insert error:", error);
        showError(error.message || "Unable to save voice expenses.");

        return false;
    }

};