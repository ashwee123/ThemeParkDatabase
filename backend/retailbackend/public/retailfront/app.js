const API_BASE = "https://retail-portal-backend-pg0i.onrender.com";

// Redirect to home if no token
const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "/";
}

// Get area info from session set by main site
const AREA_NAME    = sessionStorage.getItem("areaName");
const MANAGER_NAME = sessionStorage.getItem("managerName");

// Set portal title
document.getElementById("portal-title").textContent = `${AREA_NAME || "Retail"} Retail`;

// =============================================================
// AUTH HEADER HELPER
// =============================================================

function authHeader() {
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
}

// =============================================================
// TABS
// =============================================================

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");

        switch (tab.dataset.tab) {
            case "dashboard":    loadDashboard();    break;
            case "inventory":    loadInventory();    break;
            case "transactions": loadTransactions(); break;
            case "restock":      loadRestock();      break;
            case "stores":       loadStores();       break;
        }
    });
});

// =============================================================
// TOAST
// =============================================================

function showToast(msg, isError = false) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.className = "toast show" + (isError ? " error" : "");
    setTimeout(() => toast.className = "toast", 3000);
}

// =============================================================
// HELPERS
// =============================================================

function formatCurrency(val) {
    return `$${parseFloat(val).toFixed(2)}`;
}

function formatDate(val) {
    return val ? val.split("T")[0] : "";
}

function stockStatus(qty, threshold) {
    if (qty <= 0)         return `<span class="status status-critical">Out of Stock</span>`;
    if (qty <= threshold) return `<span class="status status-low">Low</span>`;
    return                       `<span class="status status-ok">OK</span>`;
}

function txnType(type) {
    return `<span class="type-${type.toLowerCase()}">${type}</span>`;
}

// =============================================================
// DASHBOARD
// =============================================================

async function loadDashboard() {
    const notifRes  = await fetch(`${API_BASE}/notifications`, { headers: authHeader() });
    const notifs    = await notifRes.json();
    const notifBody = document.querySelector("#tbl-notifications tbody");
    notifBody.innerHTML = notifs.length ? notifs.map(n => `
        <tr>
            <td>${n.ItemName}</td>
            <td>${n.Message}</td>
            <td>${formatDate(n.CreatedAt)}</td>
        </tr>
    `).join("") : `<tr><td colspan="3" style="color:var(--text-dim)">No notifications</td></tr>`;

    const invRes  = await fetch(`${API_BASE}/inventory`, { headers: authHeader() });
    const inv     = await invRes.json();
    const invBody = document.querySelector("#tbl-inventory tbody");
    invBody.innerHTML = inv.length ? inv.map(i => `
        <tr>
            <td>${i.ItemName}</td>
            <td>${i.RetailName}</td>
            <td>${i.Quantity}</td>
            <td>${i.LowStockThreshold}</td>
            <td>${stockStatus(i.Quantity, i.LowStockThreshold)}</td>
        </tr>
    `).join("") : `<tr><td colspan="5" style="color:var(--text-dim)">No items found</td></tr>`;
}

// =============================================================
// INVENTORY
// =============================================================

async function loadInventory() {
    const [invRes, storeRes] = await Promise.all([
        fetch(`${API_BASE}/inventory`, { headers: authHeader() }),
        fetch(`${API_BASE}/stores`,    { headers: authHeader() })
    ]);
    const inv    = await invRes.json();
    const stores = await storeRes.json();

    const storeSelect = document.getElementById("new-item-store");
    storeSelect.innerHTML = stores.map(s => `<option value="${s.RetailID}">${s.RetailName}</option>`).join("");

    const tbody = document.querySelector("#tbl-inventory-full tbody");
    tbody.innerHTML = inv.length ? inv.map(i => `
        <tr>
            <td>${i.ItemName}</td>
            <td>${i.RetailName}</td>
            <td>${formatCurrency(i.BuyPrice)}</td>
            <td>${formatCurrency(i.SellPrice)}</td>
            <td>${i.DiscountPrice ? formatCurrency(i.DiscountPrice) : "—"}</td>
            <td>${i.Quantity}</td>
            <td>${i.LowStockThreshold}</td>
            <td>${stockStatus(i.Quantity, i.LowStockThreshold)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-ghost btn-small" onclick="openEditPrice(${i.ItemID}, ${i.BuyPrice}, ${i.SellPrice}, ${i.DiscountPrice || 0})">Price</button>
                    <button class="btn btn-ghost btn-small" onclick="openAdjustQty(${i.ItemID}, ${i.Quantity})">Qty</button>
                    <button class="btn btn-ghost btn-small" onclick="openThreshold(${i.ItemID}, ${i.LowStockThreshold})">Threshold</button>
                    <button class="btn btn-danger btn-small" onclick="toggleActive(${i.ItemID}, false)">Deactivate</button>
                </div>
            </td>
        </tr>
    `).join("") : `<tr><td colspan="9" style="color:var(--text-dim)">No items found</td></tr>`;
}

document.getElementById("btn-add-item").addEventListener("click", async () => {
    const name      = document.getElementById("new-item-name").value.trim();
    const buy       = parseFloat(document.getElementById("new-item-buy").value);
    const sell      = parseFloat(document.getElementById("new-item-sell").value);
    const discount  = parseFloat(document.getElementById("new-item-discount").value) || null;
    const qty       = parseInt(document.getElementById("new-item-qty").value);
    const threshold = parseInt(document.getElementById("new-item-threshold").value) || 10;
    const retailID  = parseInt(document.getElementById("new-item-store").value);

    if (!name || !buy || !sell || !qty || !retailID) return showToast("Please fill in all required fields", true);

    const res  = await fetch(`${API_BASE}/item`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ itemName: name, buyPrice: buy, sellPrice: sell, discountPrice: discount, quantity: qty, threshold, retailID })
    });
    const data = await res.json();
    if (data.error) return showToast(data.error, true);
    showToast("Item added successfully");
    loadInventory();
});

function openEditPrice(itemID, buy, sell, discount) {
    const newBuy      = prompt("New Buy Price:", buy);
    const newSell     = prompt("New Sell Price:", sell);
    const newDiscount = prompt("New Discount Price (leave blank to clear):", discount || "");
    if (!newBuy || !newSell) return;

    fetch(`${API_BASE}/item/price`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({
            itemID,
            buyPrice:      parseFloat(newBuy),
            sellPrice:     parseFloat(newSell),
            discountPrice: newDiscount ? parseFloat(newDiscount) : null
        })
    }).then(r => r.json()).then(data => {
        if (data.error) return showToast(data.error, true);
        showToast("Prices updated");
        loadInventory();
    });
}

function openAdjustQty(itemID, current) {
    const newQty = prompt("New Quantity:", current);
    if (newQty === null) return;

    fetch(`${API_BASE}/inventory/adjust`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ itemID, newQuantity: parseInt(newQty) })
    }).then(r => r.json()).then(data => {
        if (data.error) return showToast(data.error, true);
        showToast("Quantity updated");
        loadInventory();
    });
}

function openThreshold(itemID, current) {
    const newThreshold = prompt("New Low Stock Threshold:", current);
    if (newThreshold === null) return;

    fetch(`${API_BASE}/inventory/threshold`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ itemID, threshold: parseInt(newThreshold) })
    }).then(r => r.json()).then(data => {
        if (data.error) return showToast(data.error, true);
        showToast("Threshold updated");
        loadInventory();
    });
}

function toggleActive(itemID, isActive) {
    if (!confirm(`Are you sure you want to ${isActive ? "activate" : "deactivate"} this item?`)) return;

    fetch(`${API_BASE}/item/active`, {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ itemID, isActive })
    }).then(r => r.json()).then(data => {
        if (data.error) return showToast(data.error, true);
        showToast(`Item ${isActive ? "activated" : "deactivated"}`);
        loadInventory();
    });
}

// =============================================================
// TRANSACTIONS
// =============================================================

async function loadTransactions() {
    const [txnRes, invRes] = await Promise.all([
        fetch(`${API_BASE}/transactions`, { headers: authHeader() }),
        fetch(`${API_BASE}/inventory`,    { headers: authHeader() })
    ]);
    const txns = await txnRes.json();
    const inv  = await invRes.json();

    const itemSelect = document.getElementById("txn-item");
    itemSelect.innerHTML = inv.map(i => `<option value="${i.ItemID}">${i.ItemName} (${i.RetailName})</option>`).join("");

    const tbody = document.querySelector("#tbl-transactions tbody");
    tbody.innerHTML = txns.length ? txns.map(t => `
        <tr>
            <td>${t.ItemName}</td>
            <td>${txnType(t.Type)}</td>
            <td>${t.Quantity}</td>
            <td>${formatCurrency(t.Price)}</td>
            <td>${formatCurrency(t.TotalCost)}</td>
            <td>${formatDate(t.Date)}</td>
            <td>${t.Time}</td>
        </tr>
    `).join("") : `<tr><td colspan="7" style="color:var(--text-dim)">No transactions found</td></tr>`;
}

document.getElementById("btn-log-txn").addEventListener("click", async () => {
    const itemID   = parseInt(document.getElementById("txn-item").value);
    const type     = document.getElementById("txn-type").value;
    const quantity = parseInt(document.getElementById("txn-qty").value);

    if (!itemID || !type || !quantity) return showToast("Please fill in all fields", true);

    const res  = await fetch(`${API_BASE}/transaction`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ itemID, type, quantity })
    });
    const data = await res.json();
    if (data.error) return showToast(data.error, true);
    showToast("Transaction logged successfully");
    loadTransactions();
});

// =============================================================
// RESTOCK
// =============================================================

async function loadRestock() {
    const [restockRes, invRes] = await Promise.all([
        fetch(`${API_BASE}/restock/history`, { headers: authHeader() }),
        fetch(`${API_BASE}/inventory`,        { headers: authHeader() })
    ]);
    const restocks = await restockRes.json();
    const inv      = await invRes.json();

    const itemSelect = document.getElementById("restock-item");
    itemSelect.innerHTML = inv.map(i => `<option value="${i.ItemID}">${i.ItemName} (${i.RetailName})</option>`).join("");

    const tbody = document.querySelector("#tbl-restock tbody");
    tbody.innerHTML = restocks.length ? restocks.map(r => `
        <tr>
            <td>${r.ItemName}</td>
            <td>${r.Quantity}</td>
            <td>${formatCurrency(r.Cost)}</td>
        </tr>
    `).join("") : `<tr><td colspan="3" style="color:var(--text-dim)">No restock history</td></tr>`;
}

document.getElementById("btn-log-restock").addEventListener("click", async () => {
    const itemID   = parseInt(document.getElementById("restock-item").value);
    const quantity = parseInt(document.getElementById("restock-qty").value);

    if (!itemID || !quantity) return showToast("Please fill in all fields", true);

    const res  = await fetch(`${API_BASE}/restock`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ itemID, quantity })
    });
    const data = await res.json();
    if (data.error) return showToast(data.error, true);
    showToast("Restock logged successfully");
    loadRestock();
});

// =============================================================
// REPORTS
// =============================================================

document.getElementById("btn-run-report").addEventListener("click", async () => {
    const startDate = document.getElementById("report-start").value;
    const endDate   = document.getElementById("report-end").value;

    if (!startDate || !endDate) return showToast("Please select a date range", true);

    const [reportRes, damagedRes] = await Promise.all([
        fetch(`${API_BASE}/report?startDate=${startDate}&endDate=${endDate}`,         { headers: authHeader() }),
        fetch(`${API_BASE}/damaged-stolen?startDate=${startDate}&endDate=${endDate}`, { headers: authHeader() })
    ]);

    const report  = await reportRes.json();
    const damaged = await damagedRes.json();

    const reportBody = document.querySelector("#tbl-report tbody");
    reportBody.innerHTML = report.length ? report.map(r => `
        <tr>
            <td>${r.RetailName}</td>
            <td>${r.ItemName}</td>
            <td>${r.UnitsSold}</td>
            <td>${formatCurrency(r.Revenue)}</td>
            <td>${formatCurrency(r.COGS)}</td>
            <td>${formatCurrency(r.GrossProfit)}</td>
            <td>${r.GrossMarginPct}%</td>
            <td>${r.DiscountTransactions}</td>
            <td>${r.DamagedCount}</td>
            <td>${r.StolenCount}</td>
        </tr>
    `).join("") : `<tr><td colspan="10" style="color:var(--text-dim)">No data for selected range</td></tr>`;

    const damagedBody = document.querySelector("#tbl-damaged tbody");
    damagedBody.innerHTML = damaged.length ? damaged.map(d => `
        <tr>
            <td>${d.ItemName}</td>
            <td>${txnType(d.Type)}</td>
            <td>${d.Quantity}</td>
            <td>${formatDate(d.Date)}</td>
            <td>${d.Time}</td>
        </tr>
    `).join("") : `<tr><td colspan="5" style="color:var(--text-dim)">No damaged or stolen items in range</td></tr>`;
});

// =============================================================
// STORES
// =============================================================

async function loadStores() {
    const res    = await fetch(`${API_BASE}/stores`, { headers: authHeader() });
    const stores = await res.json();

    const tbody = document.querySelector("#tbl-stores tbody");
    tbody.innerHTML = stores.length ? stores.map(s => `
        <tr>
            <td>${s.RetailID}</td>
            <td>${s.RetailName}</td>
        </tr>
    `).join("") : `<tr><td colspan="2" style="color:var(--text-dim)">No stores found</td></tr>`;
}

document.getElementById("btn-add-store").addEventListener("click", async () => {
    const name = document.getElementById("new-store-name").value.trim();
    if (!name) return showToast("Please enter a store name", true);

    const res  = await fetch(`${API_BASE}/store`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ retailName: name })
    });
    const data = await res.json();
    if (data.error) return showToast(data.error, true);
    showToast("Store added successfully");
    loadStores();
});

// =============================================================
// INIT
// =============================================================
loadDashboard();
