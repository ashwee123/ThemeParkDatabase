const API_BASE = "https://retail-portal-backend-pg0i.onrender.com";
const HOME_URL = "https://theme-park-database.vercel.app/";

const state = {
    stores: [],
    stockRows: [],
    itemRows: [],
    transactionItems: [],
    restockItems: [],
    editingItemId: null,
    selectedPriceField: "sellPrice",
    reportsData: {
        profit: [],
        loss: [],
        bought: []
    }
};

function hydrateAuthFromQuery() {
    const params = new URLSearchParams(window.location.search);
    let hydrated = false;

    const tokenFromQuery = params.get("token") || params.get("authToken");
    if (tokenFromQuery) {
        localStorage.setItem("token", tokenFromQuery);
        hydrated = true;
    }

    const areaIdFromQuery = params.get("areaID") || params.get("areaId");
    if (areaIdFromQuery) {
        sessionStorage.setItem("areaID", areaIdFromQuery);
        sessionStorage.setItem("areaId", areaIdFromQuery);
        hydrated = true;
    }

    const areaNameFromQuery = params.get("areaName");
    if (areaNameFromQuery) {
        sessionStorage.setItem("areaName", areaNameFromQuery);
        hydrated = true;
    }

    const managerNameFromQuery = params.get("managerName");
    if (managerNameFromQuery) {
        sessionStorage.setItem("managerName", managerNameFromQuery);
        hydrated = true;
    }

    if (hydrated) {
        const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash || ""}`;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

hydrateAuthFromQuery();

const token = localStorage.getItem("token");
if (!token) {
    window.location.replace(HOME_URL);
    throw new Error("Missing authentication token for retail portal");
}

const AREA_NAME = sessionStorage.getItem("areaName");
const MANAGER_NAME = sessionStorage.getItem("managerName");

function extractAreaIdFromPath() {
    const segments = window.location.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    const possibleAreaId = Number.parseInt(segments[1], 10);
    return Number.isNaN(possibleAreaId) ? null : possibleAreaId;
}

const AREA_ID = (
    sessionStorage.getItem("areaID")
    || sessionStorage.getItem("areaId")
    || extractAreaIdFromPath()
);

if (AREA_ID) {
    sessionStorage.setItem("areaID", String(AREA_ID));
    sessionStorage.setItem("areaId", String(AREA_ID));
}

document.getElementById("portal-title").textContent = AREA_NAME ? `${AREA_NAME} Retail` : "Retail";
document.getElementById("welcome-line").textContent = `Welcome ${MANAGER_NAME || "Manager"}.`;

function authHeader() {
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
    if (AREA_ID) {
        headers["X-Area-ID"] = String(AREA_ID);
    }
    return headers;
}

function showToast(msg, isError = false) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.className = "toast show" + (isError ? " error" : "");
    setTimeout(() => toast.className = "toast", 3000);
}

function formatCurrency(val) {
    return `$${parseFloat(val || 0).toFixed(2)}`;
}

function formatDate(val) {
    return val ? String(val).split("T")[0] : "";
}

function buildReportQuery(startDate, endDate, retailID) {
    const params = new URLSearchParams({ startDate, endDate });
    if (retailID) params.set("retailID", retailID);
    return params.toString();
}

function stockStatus(qty, threshold) {
    if (qty <= 0) return `<span class="status status-critical">Out of Stock</span>`;
    if (qty <= threshold) return `<span class="status status-low">Low</span>`;
    return `<span class="status status-ok">OK</span>`;
}

function txnType(type) {
    return `<span class="type-${String(type || "").toLowerCase()}">${type}</span>`;
}

function safeArray(data) {
    return Array.isArray(data) ? data : [];
}

function activePanelName() {
    const panel = document.querySelector(".panel.active");
    return panel ? panel.id.replace("tab-", "") : "inventory";
}

function applyStoreSelect(selectId, includeAllLabel = "All Stores") {
    const select = document.getElementById(selectId);
    if (!select) return;
    const selectedValue = select.value;
    select.innerHTML = [
        `<option value="">${includeAllLabel}</option>`,
        ...state.stores.map(s => `<option value="${s.RetailID}">${s.RetailName}</option>`)
    ].join("");
    if (selectedValue) select.value = selectedValue;
}

function getStoreNameById(retailID) {
    const match = state.stores.find(s => Number(s.RetailID) === Number(retailID));
    return match ? match.RetailName : "";
}

async function fetchJSON(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `${response.status} ${response.statusText}`);
    }
    return data;
}

async function loadStores() {
    const stores = safeArray(await fetchJSON("/stores", { headers: authHeader() }));
    state.stores = stores;

    const tbody = document.querySelector("#tbl-stores tbody");
    tbody.innerHTML = stores.length ? stores.map(s => `
        <tr>
            <td>${s.RetailName}</td>
            <td>
                <button class="btn btn-ghost btn-small" onclick="openStoreRename(${s.RetailID}, '${String(s.RetailName).replace(/'/g, "\\'")}')">Rename</button>
            </td>
        </tr>
    `).join("") : `<tr><td colspan="2" style="color:var(--text-dim)">No stores found</td></tr>`;

    applyStoreSelect("dashboard-store", "All Stores");
    applyStoreSelect("items-store-filter", "All Stores");
    applyStoreSelect("txn-store-filter", "All Stores");
    applyStoreSelect("restock-store-filter", "All Stores");
    applyStoreSelect("report-store", "All Stores");
    applyStoreSelect("new-item-store", "Select Store");
}

function renderDashboardStock() {
    const selectedStore = document.getElementById("dashboard-store").value;
    const rows = state.stockRows.filter(row => !selectedStore || String(row.RetailID) === String(selectedStore));

    const tbody = document.querySelector("#tbl-inventory tbody");
    tbody.innerHTML = rows.length ? rows.map(i => `
        <tr>
            <td>${i.ItemName}</td>
            <td>${i.Quantity}</td>
            <td>${stockStatus(i.Quantity, i.LowStockThreshold)}</td>
        </tr>
    `).join("") : `<tr><td colspan="3" style="color:var(--text-dim)">No items found</td></tr>`;
}

async function loadDashboard() {
    const [notifications, inventory] = await Promise.all([
        fetchJSON("/notifications", { headers: authHeader() }),
        fetchJSON("/inventory", { headers: authHeader() })
    ]);

    state.stockRows = safeArray(inventory);

    const notifBody = document.querySelector("#tbl-notifications tbody");
    const notifs = safeArray(notifications);
    notifBody.innerHTML = notifs.length ? notifs.map(n => `
        <tr>
            <td>${n.ItemName}</td>
            <td>${n.Message}</td>
            <td>${formatDate(n.CreatedAt)}</td>
        </tr>
    `).join("") : `<tr><td colspan="3" style="color:var(--text-dim)">No notifications</td></tr>`;

    renderDashboardStock();
}

function renderItemsTable() {
    const selectedStore = document.getElementById("items-store-filter").value;
    const rows = state.itemRows.filter(row => !selectedStore || String(row.RetailID) === String(selectedStore));
    const tbody = document.querySelector("#tbl-inventory-full tbody");

    tbody.innerHTML = rows.length ? rows.map(i => {
        const isEditing = state.editingItemId === i.ItemID;
        const priceField = state.selectedPriceField;

        if (isEditing) {
            return `
                <tr>
                    <td><input id="edit-item-name" value="${String(i.ItemName).replace(/"/g, "&quot;")}" /></td>
                    <td>
                        <select id="edit-price-field">
                            <option value="buyPrice" ${priceField === "buyPrice" ? "selected" : ""}>Buy Price</option>
                            <option value="sellPrice" ${priceField === "sellPrice" ? "selected" : ""}>Sell Price</option>
                            <option value="discountPrice" ${priceField === "discountPrice" ? "selected" : ""}>Discount Price</option>
                        </select>
                    </td>
                    <td><input id="edit-price-value" type="number" step="0.01" value="${priceField === "buyPrice" ? i.BuyPrice : (priceField === "sellPrice" ? i.SellPrice : (i.DiscountPrice || ""))}" /></td>
                    <td><input id="edit-threshold" type="number" value="${i.LowStockThreshold}" /></td>
                    <td><input id="edit-quantity" type="number" value="${i.Quantity}" /></td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-primary btn-small" onclick="saveItemEdit(${i.ItemID})">Save</button>
                            <button class="btn btn-ghost btn-small" onclick="cancelItemEdit()">Cancel</button>
                        </div>
                    </td>
                </tr>
            `;
        }

        return `
            <tr>
                <td>${i.ItemName}</td>
                <td>${formatCurrency(i.BuyPrice)}</td>
                <td>${formatCurrency(i.SellPrice)}</td>
                <td>${i.DiscountPrice ? formatCurrency(i.DiscountPrice) : "—"}</td>
                <td>${i.LowStockThreshold}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-ghost btn-small" onclick="startItemEdit(${i.ItemID})">Edit</button>
                        <button class="btn btn-danger btn-small" onclick="toggleActive(${i.ItemID}, false)">Deactivate</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("") : `<tr><td colspan="6" style="color:var(--text-dim)">No items found</td></tr>`;
}

async function loadItems() {
    const inventory = await fetchJSON("/inventory", { headers: authHeader() });
    state.itemRows = safeArray(inventory);
    state.stockRows = safeArray(inventory);
    renderItemsTable();
    renderDashboardStock();
}

async function saveItemEdit(itemID) {
    const item = state.itemRows.find(i => Number(i.ItemID) === Number(itemID));
    if (!item) return;

    const itemName = document.getElementById("edit-item-name").value.trim();
    const threshold = Number.parseInt(document.getElementById("edit-threshold").value, 10);
    const quantity = Number.parseInt(document.getElementById("edit-quantity").value, 10);
    const priceField = document.getElementById("edit-price-field").value;
    const priceValueRaw = document.getElementById("edit-price-value").value;

    const buyPrice = priceField === "buyPrice" ? Number.parseFloat(priceValueRaw) : Number.parseFloat(item.BuyPrice);
    const sellPrice = priceField === "sellPrice" ? Number.parseFloat(priceValueRaw) : Number.parseFloat(item.SellPrice);
    const discountPrice = priceField === "discountPrice"
        ? (priceValueRaw === "" ? null : Number.parseFloat(priceValueRaw))
        : (item.DiscountPrice === null ? null : Number.parseFloat(item.DiscountPrice));

    if (!itemName || Number.isNaN(threshold) || Number.isNaN(quantity) || Number.isNaN(buyPrice) || Number.isNaN(sellPrice)) {
        return showToast("Please enter valid values before saving", true);
    }

    await fetchJSON("/item/name", {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ itemID, itemName })
    });

    await fetchJSON("/item/price", {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ itemID, buyPrice, sellPrice, discountPrice })
    });

    await fetchJSON("/inventory/threshold", {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ itemID, threshold })
    });

    await fetchJSON("/inventory/adjust", {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ itemID, newQuantity: quantity })
    });

    state.editingItemId = null;
    showToast("Item updated successfully");
    await loadItems();
}

function startItemEdit(itemID) {
    state.editingItemId = itemID;
    state.selectedPriceField = "sellPrice";
    renderItemsTable();
}

function cancelItemEdit() {
    state.editingItemId = null;
    renderItemsTable();
}

window.startItemEdit = startItemEdit;
window.cancelItemEdit = cancelItemEdit;
window.saveItemEdit = saveItemEdit;

document.getElementById("btn-add-item").addEventListener("click", async () => {
    const itemName = document.getElementById("new-item-name").value.trim();
    const buyPrice = Number.parseFloat(document.getElementById("new-item-buy").value);
    const sellPrice = Number.parseFloat(document.getElementById("new-item-sell").value);
    const discountPriceRaw = document.getElementById("new-item-discount").value;
    const quantity = Number.parseInt(document.getElementById("new-item-qty").value, 10);
    const threshold = Number.parseInt(document.getElementById("new-item-threshold").value || "10", 10);
    const retailID = Number.parseInt(document.getElementById("new-item-store").value, 10);
    const discountPrice = discountPriceRaw === "" ? null : Number.parseFloat(discountPriceRaw);

    if (!itemName || Number.isNaN(buyPrice) || Number.isNaN(sellPrice) || Number.isNaN(quantity) || Number.isNaN(retailID)) {
        return showToast("Please fill in all required fields", true);
    }

    await fetchJSON("/item", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ itemName, buyPrice, sellPrice, discountPrice, quantity, threshold, retailID })
    });

    showToast("Item added successfully");
    await loadItems();
});

async function toggleActive(itemID, isActive) {
    if (!confirm(`Are you sure you want to ${isActive ? "activate" : "deactivate"} this item?`)) return;
    await fetchJSON("/item/active", {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ itemID, isActive })
    });
    showToast(`Item ${isActive ? "activated" : "deactivated"} successfully`);
    await loadItems();
}

window.toggleActive = toggleActive;

function renderTransactionItemOptions() {
    const selectedStore = document.getElementById("txn-store-filter").value;
    const itemSelect = document.getElementById("txn-item");
    const filtered = state.transactionItems.filter(i => !selectedStore || String(i.RetailID) === String(selectedStore));
    itemSelect.innerHTML = filtered.map(i => `<option value="${i.ItemID}">${i.ItemName} (${i.RetailName})</option>`).join("");
}

async function loadTransactions() {
    const [transactions, inventory] = await Promise.all([
        fetchJSON("/transactions", { headers: authHeader() }),
        fetchJSON("/inventory", { headers: authHeader() })
    ]);
    state.transactionItems = safeArray(inventory);
    renderTransactionItemOptions();

    const tbody = document.querySelector("#tbl-transactions tbody");
    const txns = safeArray(transactions);
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

document.getElementById("txn-store-filter").addEventListener("change", renderTransactionItemOptions);

document.getElementById("btn-log-txn").addEventListener("click", async () => {
    const itemID = Number.parseInt(document.getElementById("txn-item").value, 10);
    const type = document.getElementById("txn-type").value;
    const quantity = Number.parseInt(document.getElementById("txn-qty").value, 10);

    if (Number.isNaN(itemID) || !type || Number.isNaN(quantity)) {
        return showToast("Please fill in all fields", true);
    }

    await fetchJSON("/transaction", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ itemID, type, quantity, visitorID: 0 })
    });

    showToast("Transaction logged successfully");
    await loadTransactions();
});

function renderRestockItemOptions() {
    const selectedStore = document.getElementById("restock-store-filter").value;
    const select = document.getElementById("restock-item");
    const filtered = state.restockItems.filter(i => !selectedStore || String(i.RetailID) === String(selectedStore));
    select.innerHTML = filtered.map(i => `<option value="${i.ItemID}">${i.ItemName} (${i.RetailName})</option>`).join("");
}

async function loadRestock() {
    const [restockHistory, inventory] = await Promise.all([
        fetchJSON("/restock/history", { headers: authHeader() }),
        fetchJSON("/inventory", { headers: authHeader() })
    ]);

    state.restockItems = safeArray(inventory);
    renderRestockItemOptions();

    const rows = safeArray(restockHistory);
    const tbody = document.querySelector("#tbl-restock tbody");
    tbody.innerHTML = rows.length ? rows.map(r => `
        <tr>
            <td>${r.ItemName}</td>
            <td>${r.Quantity}</td>
            <td>${formatCurrency(r.Cost)}</td>
        </tr>
    `).join("") : `<tr><td colspan="3" style="color:var(--text-dim)">No restock history</td></tr>`;
}

document.getElementById("restock-store-filter").addEventListener("change", renderRestockItemOptions);

document.getElementById("btn-log-restock").addEventListener("click", async () => {
    const itemID = Number.parseInt(document.getElementById("restock-item").value, 10);
    const quantity = Number.parseInt(document.getElementById("restock-qty").value, 10);

    if (Number.isNaN(itemID) || Number.isNaN(quantity)) {
        return showToast("Please fill in all fields", true);
    }

    await fetchJSON("/restock", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ itemID, quantity })
    });

    showToast("Restock order logged");
    await loadRestock();
});

async function loadReports() {
    const startDate = document.getElementById("report-start").value;
    const endDate = document.getElementById("report-end").value;
    const retailID = document.getElementById("report-store").value;

    if (!startDate || !endDate) {
        showToast("Please select a date range", true);
        return;
    }

    const query = buildReportQuery(startDate, endDate, retailID);
    const [profit, loss, bought] = await Promise.all([
        fetchJSON(`/report?${query}`, { headers: authHeader() }),
        fetchJSON(`/inventory-loss?${query}`, { headers: authHeader() }),
        fetchJSON(`/items-bought?${query}`, { headers: authHeader() })
    ]);

    state.reportsData.profit = safeArray(profit);
    state.reportsData.loss = safeArray(loss);
    state.reportsData.bought = safeArray(bought);
    renderActiveReport();
}

function renderActiveReport() {
    const selectedReport = document.getElementById("report-type").value;

    const profitWrap = document.getElementById("profit-report-wrap");
    const lossWrap = document.getElementById("loss-report-wrap");
    const boughtWrap = document.getElementById("bought-report-wrap");

    profitWrap.style.display = selectedReport === "profit" ? "block" : "none";
    lossWrap.style.display = selectedReport === "loss" ? "block" : "none";
    boughtWrap.style.display = selectedReport === "bought" ? "block" : "none";

    const profitBody = document.querySelector("#tbl-report tbody");
    profitBody.innerHTML = state.reportsData.profit.length ? state.reportsData.profit.map(r => `
        <tr>
            <td>${r.RetailName}</td>
            <td>${r.ItemName}</td>
            <td>${r.UnitsSold}</td>
            <td>${formatCurrency(r.Revenue)}</td>
            <td>${formatCurrency(r.COGS)}</td>
            <td>${formatCurrency(r.GrossProfit)}</td>
            <td>${Number(r.GrossMarginPct || 0).toFixed(2)}%</td>
            <td>${r.DiscountTransactions}</td>
            <td>${r.DamagedCount}</td>
            <td>${r.StolenCount}</td>
        </tr>
    `).join("") : `<tr><td colspan="10" style="color:var(--text-dim)">No data for selected range</td></tr>`;

    const lossBody = document.querySelector("#tbl-damaged tbody");
    lossBody.innerHTML = state.reportsData.loss.length ? state.reportsData.loss.map(d => `
        <tr>
            <td>${d.RetailName}</td>
            <td>${d.ItemName}</td>
            <td>${txnType(d.Type)}</td>
            <td>${d.Quantity}</td>
            <td>${formatDate(d.Date)}</td>
            <td>${d.Time}</td>
        </tr>
    `).join("") : `<tr><td colspan="6" style="color:var(--text-dim)">No inventory loss records in range</td></tr>`;

    const boughtBody = document.querySelector("#tbl-items-bought tbody");
    boughtBody.innerHTML = state.reportsData.bought.length ? state.reportsData.bought.map(b => `
        <tr>
            <td>${b.RetailName}</td>
            <td>${b.ItemName}</td>
            <td>${b.TotalQuantityBought}</td>
        </tr>
    `).join("") : `<tr><td colspan="3" style="color:var(--text-dim)">No purchased items in range</td></tr>`;
}

document.getElementById("btn-run-report").addEventListener("click", loadReports);
document.getElementById("report-type").addEventListener("change", renderActiveReport);

document.getElementById("dashboard-store").addEventListener("change", renderDashboardStock);
document.getElementById("items-store-filter").addEventListener("change", renderItemsTable);

document.getElementById("btn-add-store").addEventListener("click", async () => {
    const name = document.getElementById("new-store-name").value.trim();
    if (!name) return showToast("Please enter a store name", true);

    await fetchJSON("/store", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ retailName: name })
    });

    showToast("Store added successfully");
    document.getElementById("new-store-name").value = "";
    await loadStores();
});

async function openStoreRename(retailID, retailName) {
    const nextName = prompt("Update store name:", retailName);
    if (!nextName || !nextName.trim()) return;
    await fetchJSON("/store/name", {
        method: "PUT",
        headers: authHeader(),
        body: JSON.stringify({ retailID, retailName: nextName.trim() })
    });
    showToast("Store name updated");
    await loadStores();
}

window.openStoreRename = openStoreRename;

document.getElementById("btn-logout").addEventListener("click", () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("areaID");
    sessionStorage.removeItem("areaId");
    sessionStorage.removeItem("areaName");
    sessionStorage.removeItem("managerName");
    window.location.replace(HOME_URL);
});

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", async () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");

        try {
            switch (tab.dataset.tab) {
                case "dashboard":
                    await loadDashboard();
                    break;
                case "inventory":
                    await Promise.all([loadStores(), loadItems()]);
                    break;
                case "transactions":
                    await Promise.all([loadStores(), loadTransactions()]);
                    break;
                case "restock":
                    await Promise.all([loadStores(), loadRestock()]);
                    break;
                case "reports":
                    await loadStores();
                    break;
                case "stores":
                    await loadStores();
                    break;
            }
        } catch (error) {
            console.error(error);
            showToast(error.message || "Failed to load data", true);
        }
    });
});

(async function init() {
    try {
        await loadStores();
        await loadDashboard();
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to initialize portal", true);
    }
})();
